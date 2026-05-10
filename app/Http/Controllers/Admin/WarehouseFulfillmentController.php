<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VoucherItem;
use App\Models\WarehouseFulfillmentInstruction;
use App\Services\Audit\AuditLogger;
use App\Services\Inventory\StockLedgerService;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseFulfillmentController extends Controller
{
    public function __construct(
        private StockLedgerService $stockLedger,
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->assignedWarehousesOnly($user);
        $allowedIds = $this->operationalContext->assignedWarehouseIds($user);

        $rawFilter = $request->query('warehouse_id', 'all');
        $selectedFilter = 'all';
        if ($rawFilter !== null && $rawFilter !== '' && (string) $rawFilter !== 'all') {
            $candidate = (int) $rawFilter;
            if (in_array($candidate, $allowedIds, true)) {
                $selectedFilter = (string) $candidate;
            }
        }

        $query = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'PENDING_ACTION');

        if ($selectedFilter !== 'all') {
            $query->where('warehouse_id', (int) $selectedFilter);
        } elseif ($allowedIds === []) {
            $query->whereRaw('1 = 0');
        } else {
            $query->whereIn('warehouse_id', $allowedIds);
        }

        $instructions = $query
            ->with([
                'warehouse:id,name,code',
                'nextWarehouse:id,name,code',
                'merchant:id,name',
                'tripItem:id,trip_id',
                'tripItem.trip:id,trip_no,status',
                'voucherItem:id,voucher_id,line_no,product_id,unit,payment_status',
                'voucherItem.voucher:id,voucher_no,payment_status',
                'voucherItem.product:id,name,unit',
            ])
            ->orderByDesc('id')
            ->limit(400)
            ->get();

        return Inertia::render('Admin/Operations/WarehouseFulfillmentInbox', [
            'instructions' => $instructions,
            'warehouses' => $warehouses,
            'fulfillment_warehouse_filter' => $selectedFilter,
        ]);
    }

    public function dispatchInstruction(Request $request, string $instruction): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'action_type' => ['required', Rule::in(['OWNER_PICKUP', 'DIRECT_DELIVERY', 'FORWARD_TO_WAREHOUSE'])],
            'qty' => ['required', 'numeric', 'min:0.001'],
            'next_warehouse_id' => [
                'nullable',
                'integer',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $assignedIds = $this->operationalContext->assignedWarehouseIds($actor);

        try {
            DB::transaction(function () use ($validated, $organizationId, $instruction, $actor, $assignedIds) {
                $row = WarehouseFulfillmentInstruction::query()
                    ->whereKey($instruction)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array((int) $row->warehouse_id, $assignedIds, true)) {
                    throw ValidationException::withMessages([
                        'qty' => ['You do not have access to process this warehouse queue.'],
                    ]);
                }

                if ($row->status !== 'PENDING_ACTION') {
                    throw ValidationException::withMessages([
                        'qty' => ['This instruction is already completed.'],
                    ]);
                }

                $voucherItem = VoucherItem::query()
                    ->whereKey($row->voucher_item_id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $qty = round((float) $validated['qty'], 3);
                $remaining = round((float) $row->qty_received - (float) $row->qty_dispatched, 3);
                if ($qty > $remaining + 0.0001) {
                    throw ValidationException::withMessages([
                        'qty' => ['Dispatch quantity cannot exceed remaining quantity on this instruction.'],
                    ]);
                }

                $actionType = $validated['action_type'];
                $note = isset($validated['note']) && trim((string) $validated['note']) !== '' ? trim((string) $validated['note']) : null;

                if ($actionType === 'FORWARD_TO_WAREHOUSE') {
                    $nextWarehouseId = (int) ($validated['next_warehouse_id'] ?? 0);
                    if ($nextWarehouseId <= 0) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['Select destination warehouse to forward.'],
                        ]);
                    }
                    if ($nextWarehouseId === (int) $row->warehouse_id) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['Forward warehouse must be different from current warehouse.'],
                        ]);
                    }

                    if (! in_array($nextWarehouseId, $assignedIds, true)) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['You cannot forward to this warehouse with your current access.'],
                        ]);
                    }

                    $this->stockLedger->applyWarehouseDispatch(
                        vi: $voucherItem,
                        warehouseId: (int) $row->warehouse_id,
                        qtyLeaving: $qty,
                        movementType: 'TRANSFER_OUT',
                        refType: 'WAREHOUSE_FULFILLMENT',
                        refId: (int) $row->id,
                        actor: $actor,
                        note: $note,
                    );

                    $this->stockLedger->applyWarehouseTransferIn(
                        vi: $voucherItem,
                        warehouseId: $nextWarehouseId,
                        qtyIn: $qty,
                        refType: 'WAREHOUSE_FULFILLMENT',
                        refId: (int) $row->id,
                        actor: $actor,
                        note: $note,
                    );

                    WarehouseFulfillmentInstruction::query()->create([
                        'organization_id' => $organizationId,
                        'warehouse_id' => $nextWarehouseId,
                        'trip_item_id' => $row->trip_item_id,
                        'voucher_item_id' => $row->voucher_item_id,
                        'merchant_id' => $row->merchant_id,
                        'qty_received' => $qty,
                        'qty_dispatched' => 0,
                        'status' => 'PENDING_ACTION',
                        'next_action_type' => null,
                        'next_warehouse_id' => null,
                        'note' => 'Forwarded from warehouse ID '.$row->warehouse_id,
                        'last_updated_by' => $actor->id,
                    ]);

                    $row->next_action_type = 'FORWARD_TO_WAREHOUSE';
                    $row->next_warehouse_id = $nextWarehouseId;
                } else {
                    $movementType = 'DELIVERY';
                    $this->stockLedger->applyWarehouseDispatch(
                        vi: $voucherItem,
                        warehouseId: (int) $row->warehouse_id,
                        qtyLeaving: $qty,
                        movementType: $movementType,
                        refType: 'WAREHOUSE_FULFILLMENT',
                        refId: (int) $row->id,
                        actor: $actor,
                        note: $note,
                    );
                    $row->next_action_type = $actionType;
                }

                $row->qty_dispatched = round((float) $row->qty_dispatched + $qty, 3);
                $row->last_updated_by = $actor->id;
                if ((float) $row->qty_dispatched >= (float) $row->qty_received - 0.0001) {
                    $row->status = 'COMPLETED';
                }
                if ($note !== null) {
                    $row->note = $note;
                }
                $row->save();

                AuditLogger::record($actor, 'warehouse_fulfillment.dispatch', $row, [
                    'instruction_id' => $row->id,
                    'action_type' => $actionType,
                    'qty' => $qty,
                    'warehouse_id' => $row->warehouse_id,
                    'next_warehouse_id' => $row->next_warehouse_id,
                ]);
            });
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors())->withInput();
        }

        return back()->with('success', 'Fulfillment action recorded.');
    }
}

