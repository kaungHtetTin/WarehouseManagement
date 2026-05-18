<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TripItem;
use App\Models\TripStop;
use App\Models\VoucherItem;
use App\Models\VoucherPayment;
use App\Models\WarehouseFulfillmentInstruction;
use App\Services\Audit\AuditLogger;
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
        private OperationalWarehouseContext $operationalContext,
    ) {}

    private function abortFulfillmentHidden(): void
    {
        abort(404);
    }

    public function storeVoucherPayment(Request $request, string $voucher): RedirectResponse
    {
        $this->abortFulfillmentHidden();

        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherModel = \App\Models\Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);
        abort_if($voucherModel->payment_status === 'WAIVED', 422, 'Cannot add payments to a waived voucher.');
        abort_if($voucherModel->total_amount === null, 422, 'Cannot add payments when total amount is not set.');

        $total = $voucherModel->total_amount !== null ? round((float) $voucherModel->total_amount, 2) : 0.0;
        $paid = round((float) \App\Models\VoucherPayment::query()
            ->where('voucher_id', $voucherModel->id)
            ->where('organization_id', $organizationId)
            ->sum('amount'), 2);
        
        $maxAllowed = max(0, $total - $paid);
        abort_if($maxAllowed < 0.01, 422, 'Voucher is already fully paid.');

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', "max:{$maxAllowed}"],
            'currency' => ['nullable', 'string', 'max:8'],
            'payment_method' => ['required', Rule::in(['CASH', 'TRANSFER', 'OTHER'])],
            'paid_at' => ['required', 'date'],
            'reference_no' => ['nullable', 'string', 'max:128'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($validated, $organizationId, $voucherModel, $actor) {
            $payment = VoucherPayment::query()->create([
                'organization_id' => $organizationId,
                'voucher_id' => $voucherModel->id,
                'amount' => round((float) $validated['amount'], 2),
                'currency' => isset($validated['currency']) && trim((string) $validated['currency']) !== ''
                    ? trim((string) $validated['currency'])
                    : 'MMK',
                'payment_method' => $validated['payment_method'],
                'paid_at' => $validated['paid_at'],
                'reference_no' => $validated['reference_no'] ?? null,
                'note' => $validated['note'] ?? null,
                'received_by' => $actor->id,
            ]);

            $total = round((float) $voucherModel->total_amount, 2);
            $paid = round((float) VoucherPayment::query()
                ->where('voucher_id', $voucherModel->id)
                ->where('organization_id', $organizationId)
                ->sum('amount'), 2);

            if ($paid <= 0.005) {
                $next = 'UNPAID';
            } elseif ($paid + 0.005 >= $total) {
                $next = 'PAID';
            } else {
                $next = 'PARTIAL';
            }

            if ($voucherModel->payment_status !== $next) {
                $voucherModel->payment_status = $next;
                $voucherModel->save();
            }
        });

        AuditLogger::record($actor, 'voucher.payment.record', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'amount' => round((float) $validated['amount'], 2),
            'payment_method' => $validated['payment_method'],
            'context' => 'fulfillment_inbox',
        ]);

        return redirect()->back()->with('success', 'Payment recorded from fulfillment.');
    }

    public function setVoucherWaived(Request $request, string $voucher): RedirectResponse
    {
        $this->abortFulfillmentHidden();

        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherModel = \App\Models\Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);

        $validated = $request->validate([
            'waived' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($validated, $voucherModel, $organizationId) {
            $voucherModel->refresh();

            $paid = round((float) \App\Models\VoucherPayment::query()
                ->where('voucher_id', $voucherModel->id)
                ->where('organization_id', $organizationId)
                ->sum('amount'), 2);

            if ((bool) $validated['waived'] === true) {
                abort_if($paid > 0.005, 422, 'Cannot waive a voucher with recorded payments.');
                if ($voucherModel->payment_status !== 'WAIVED') {
                    $voucherModel->payment_status = 'WAIVED';
                    $voucherModel->save();
                }
                return;
            }

            if ($voucherModel->payment_status === 'WAIVED') {
                $voucherModel->payment_status = 'UNPAID';
                $voucherModel->save();
            }

            if ($voucherModel->total_amount === null) {
                return;
            }

            $total = round((float) $voucherModel->total_amount, 2);
            $paid = round((float) \App\Models\VoucherPayment::query()
                ->where('voucher_id', $voucherModel->id)
                ->where('organization_id', $organizationId)
                ->sum('amount'), 2);

            if ($paid <= 0.005) {
                $next = 'UNPAID';
            } elseif ($paid + 0.005 >= $total) {
                $next = 'PAID';
            } else {
                $next = 'PARTIAL';
            }

            if ($voucherModel->payment_status !== $next) {
                $voucherModel->payment_status = $next;
                $voucherModel->save();
            }
        });

        AuditLogger::record($actor, 'voucher.payment.waive', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'waived' => (bool) $validated['waived'],
            'context' => 'fulfillment_inbox',
        ]);

        return redirect()->back()->with('success', 'Payment status updated.');
    }

    public function index(Request $request): Response
    {
        $this->abortFulfillmentHidden();

        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->assignedWarehousesOnly($user);
        $allowedIds = $this->operationalContext->assignedWarehouseIds($user);

        $rawStatusFilter = (string) $request->query('status', 'pending');
        $selectedStatusFilter = in_array($rawStatusFilter, ['incoming', 'pending', 'completed', 'all'], true) ? $rawStatusFilter : 'pending';

        $rawFilter = $request->query('warehouse_id', 'all');
        $selectedFilter = 'all';
        if ($rawFilter !== null && $rawFilter !== '' && (string) $rawFilter !== 'all') {
            $candidate = (int) $rawFilter;
            if (in_array($candidate, $allowedIds, true)) {
                $selectedFilter = (string) $candidate;
            }
        }

        $includeIncoming = in_array($selectedStatusFilter, ['incoming', 'all'], true);
        $includeInstructions = $selectedStatusFilter !== 'incoming';

        $instructions = collect();
        if ($includeInstructions) {
            $query = WarehouseFulfillmentInstruction::query()
                ->where('organization_id', $organizationId);

            if ($selectedStatusFilter === 'pending') {
                $query->where(function ($q) {
                    $q->where('status', 'PENDING_ACTION')
                        ->orWhere(function ($q2) {
                            $q2->where('status', 'COMPLETED')
                                ->whereHas('voucherItem.voucher', fn ($v) => $v->whereIn('payment_status', ['UNPAID', 'PARTIAL']));
                        });
                });
            } elseif ($selectedStatusFilter === 'completed') {
                $query->where('status', 'COMPLETED');
            } else {
                $query->whereIn('status', ['PENDING_ACTION', 'COMPLETED']);
            }

            if ($selectedFilter !== 'all') {
                $query->where('warehouse_id', (int) $selectedFilter);
            } elseif ($allowedIds === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('warehouse_id', $allowedIds);
            }

            $instructions = $query
                ->with([
                    'warehouse:id,city,address',
                    'nextWarehouse:id,city,address',
                    'merchant:id,name',
                    'tripItem:id,trip_id',
                    'tripItem.trip:id,trip_no,status',
                    'voucherItem:id,voucher_id,line_no,product_id,unit',
                    'voucherItem.voucher:id,voucher_no,payment_status,total_amount,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone',
                    'voucherItem.voucher.defaultToWarehouse:id,city,address',
                    'voucherItem.product:id,name,unit',
                ])
                ->orderByDesc('id')
                ->limit(400)
                ->get();

            if (! $instructions->isEmpty()) {
                $voucherIds = $instructions
                    ->pluck('voucherItem.voucher_id')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all();

                if ($voucherIds !== []) {
                    $paidByVoucher = VoucherPayment::query()
                        ->where('organization_id', $organizationId)
                        ->whereIn('voucher_id', $voucherIds)
                        ->selectRaw('voucher_id, SUM(amount) as paid')
                        ->groupBy('voucher_id')
                        ->pluck('paid', 'voucher_id');

                    foreach ($instructions as $row) {
                        $voucher = $row->voucherItem?->voucher;
                        if (! $voucher || ! $voucher->id) {
                            continue;
                        }
                        $vid = (int) $voucher->id;
                        $totalRaw = $voucher->total_amount;
                        $total = $totalRaw !== null && $totalRaw !== '' ? round((float) $totalRaw, 2) : null;
                        $paid = round((float) ($paidByVoucher[$vid] ?? 0), 2);
                        $remaining = $total !== null ? round(max(0, $total - $paid), 2) : null;
                        if ($voucher->payment_status === 'WAIVED') {
                            $remaining = 0.0;
                        }

                        $row->setAttribute('voucher_total_amount', $total);
                        $row->setAttribute('voucher_paid_amount', $paid);
                        $row->setAttribute('voucher_remaining_amount', $remaining);
                    }
                }
            }
        }

        $incoming = [];
        if ($includeIncoming) {
            $incoming = $this->buildIncomingRows(
                organizationId: (int) $organizationId,
                assignedWarehouseIds: $allowedIds,
                warehouses: $warehouses,
                warehouseFilter: $selectedFilter === 'all' ? null : (int) $selectedFilter,
            );
        }

        $rows = $includeInstructions
            ? $instructions->values()->all()
            : [];
        if ($includeIncoming) {
            $rows = array_merge($incoming, $rows);
        }

        return Inertia::render('Admin/Operations/WarehouseFulfillmentInbox', [
            'instructions' => $rows,
            'warehouses' => $warehouses,
            'fulfillment_warehouse_filter' => $selectedFilter,
            'fulfillment_status_filter' => $selectedStatusFilter,
            'fulfillment_page' => 'inbox',
            'fulfillment_base_path' => '/operations/fulfillment/inbox',
            'fulfillment_fixed_status' => false,
        ]);
    }

    public function incoming(Request $request): Response
    {
        $this->abortFulfillmentHidden();

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

        $incoming = $this->buildIncomingRows(
            organizationId: (int) $organizationId,
            assignedWarehouseIds: $allowedIds,
            warehouses: $warehouses,
            warehouseFilter: $selectedFilter === 'all' ? null : (int) $selectedFilter,
        );

        return Inertia::render('Admin/Operations/WarehouseFulfillmentInbox', [
            'instructions' => $incoming,
            'warehouses' => $warehouses,
            'fulfillment_warehouse_filter' => $selectedFilter,
            'fulfillment_status_filter' => 'incoming',
            'fulfillment_page' => 'incoming',
            'fulfillment_base_path' => '/operations/fulfillment/incoming',
            'fulfillment_fixed_status' => true,
        ]);
    }

    private function buildIncomingRows(int $organizationId, array $assignedWarehouseIds, $warehouses, ?int $warehouseFilter = null): array
    {
        if ($assignedWarehouseIds === []) {
            return [];
        }

        $warehouseById = [];
        foreach ($warehouses as $w) {
            $warehouseById[(int) $w->id] = $w;
        }

        $tripItems = TripItem::query()
            ->where('organization_id', $organizationId)
            ->where('loaded_qty', '>', 0)
            ->whereHas('trip', fn ($q) => $q->whereIn('status', ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP']))
            ->with([
                'trip:id,trip_no,status',
                'tripStop:id,trip_id,warehouse_id',
                'voucherItem:id,voucher_id,line_no,product_id,unit',
                'voucherItem.product:id,name,unit',
                'voucherItem.voucher:id,voucher_no,payment_status,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone,merchant_id',
                'voucherItem.voucher.defaultToWarehouse:id,city,address',
                'voucherItem.voucher.merchant:id,name',
            ])
            ->orderByDesc('id')
            ->limit(600)
            ->get();

        if ($tripItems->isEmpty()) {
            return [];
        }

        $existing = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $organizationId)
            ->whereIn('trip_item_id', $tripItems->pluck('id')->all())
            ->get(['trip_item_id', 'warehouse_id', 'voucher_item_id'])
            ->map(fn ($r) => ((int) $r->trip_item_id).':'.((int) $r->warehouse_id).':'.((int) $r->voucher_item_id))
            ->flip();

        $out = [];
        foreach ($tripItems as $item) {
            $vi = $item->voucherItem;
            if (! $vi || ! $vi->voucher) {
                continue;
            }

            $receivingWarehouseId = $this->resolveReceivingWarehouseId($item, $vi, $organizationId);
            if ($receivingWarehouseId === null) {
                continue;
            }
            if ($warehouseFilter !== null && $receivingWarehouseId !== $warehouseFilter) {
                continue;
            }
            if (! in_array($receivingWarehouseId, $assignedWarehouseIds, true)) {
                continue;
            }

            $inTransitQty = round((float) $item->loaded_qty - (float) $item->delivered_qty, 3);
            if ($inTransitQty < 0.0001) {
                continue;
            }

            $key = ((int) $item->id).':'.$receivingWarehouseId.':'.((int) $vi->id);
            if (isset($existing[$key])) {
                continue;
            }

            $warehouse = $warehouseById[$receivingWarehouseId] ?? null;
            if ($warehouse === null) {
                continue;
            }

            $voucher = $vi->voucher;
            $out[] = [
                'id' => 'incoming-'.$item->id.'-'.$receivingWarehouseId,
                'warehouse_id' => $receivingWarehouseId,
                'warehouse' => $warehouse->only(['id', 'city', 'address', 'display_name']),
                'next_warehouse_id' => null,
                'next_warehouse' => null,
                'merchant_id' => $voucher->merchant_id ?? null,
                'merchant' => $voucher->merchant ? $voucher->merchant->only(['id', 'name']) : null,
                'trip_item_id' => (int) $item->id,
                'trip_item' => [
                    'id' => (int) $item->id,
                    'trip_id' => (int) $item->trip_id,
                    'trip' => $item->trip ? $item->trip->only(['id', 'trip_no', 'status']) : null,
                ],
                'voucher_item_id' => (int) $vi->id,
                'voucher_item' => $vi->toArray(),
                'qty_received' => number_format(max(0, $inTransitQty), 3, '.', ''),
                'qty_dispatched' => '0.000',
                'status' => 'INCOMING',
                'next_action_type' => null,
                'note' => null,
                'last_updated_by' => null,
            ];
        }

        return $out;
    }

    private function resolveReceivingWarehouseId(TripItem $tripItem, VoucherItem $voucherItem, int $organizationId): ?int
    {
        if ($tripItem->trip_stop_id !== null) {
            if ($tripItem->relationLoaded('tripStop') && $tripItem->tripStop !== null && $tripItem->tripStop->warehouse_id !== null) {
                return (int) $tripItem->tripStop->warehouse_id;
            }

            $stop = TripStop::query()
                ->whereKey($tripItem->trip_stop_id)
                ->where('organization_id', $organizationId)
                ->where('trip_id', $tripItem->trip_id)
                ->first();
            if ($stop !== null && $stop->warehouse_id !== null) {
                return (int) $stop->warehouse_id;
            }
        }

        $voucher = $voucherItem->voucher;

        return $voucher !== null && $voucher->default_to_warehouse_id !== null
            ? (int) $voucher->default_to_warehouse_id
            : null;
    }

    public function dispatchInstruction(Request $request, string $instruction): RedirectResponse
    {
        $this->abortFulfillmentHidden();

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
                if (abs($qty - $remaining) > 0.0001) {
                    throw ValidationException::withMessages([
                        'qty' => ['Dispatch quantity must match the full remaining quantity on this instruction.'],
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

    public function dispatchVoucher(Request $request, string $warehouse, string $voucher): RedirectResponse
    {
        $this->abortFulfillmentHidden();

        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'action_type' => ['required', Rule::in(['OWNER_PICKUP', 'DIRECT_DELIVERY', 'FORWARD_TO_WAREHOUSE'])],
            'next_warehouse_id' => [
                'nullable',
                'integer',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $assignedIds = $this->operationalContext->assignedWarehouseIds($actor);
        $warehouseId = (int) $warehouse;
        $voucherId = (int) $voucher;

        try {
            $processed = 0;

            DB::transaction(function () use ($validated, $organizationId, $actor, $assignedIds, $warehouseId, $voucherId, &$processed) {
                if (! in_array($warehouseId, $assignedIds, true)) {
                    throw ValidationException::withMessages([
                        'action_type' => ['You do not have access to process this warehouse queue.'],
                    ]);
                }

                $actionType = $validated['action_type'];
                $note = isset($validated['note']) && trim((string) $validated['note']) !== '' ? trim((string) $validated['note']) : null;

                $nextWarehouseId = null;
                if ($actionType === 'FORWARD_TO_WAREHOUSE') {
                    $nextWarehouseId = (int) ($validated['next_warehouse_id'] ?? 0);
                    if ($nextWarehouseId <= 0) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['Select destination warehouse to forward.'],
                        ]);
                    }
                    if ($nextWarehouseId === $warehouseId) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['Forward warehouse must be different from current warehouse.'],
                        ]);
                    }
                    if (! in_array($nextWarehouseId, $assignedIds, true)) {
                        throw ValidationException::withMessages([
                            'next_warehouse_id' => ['You cannot forward to this warehouse with your current access.'],
                        ]);
                    }
                }

                $rows = WarehouseFulfillmentInstruction::query()
                    ->where('organization_id', $organizationId)
                    ->where('status', 'PENDING_ACTION')
                    ->where('warehouse_id', $warehouseId)
                    ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucherId))
                    ->lockForUpdate()
                    ->get();

                if ($rows->isEmpty()) {
                    throw ValidationException::withMessages([
                        'action_type' => ['No pending fulfillment instructions for this voucher in this warehouse.'],
                    ]);
                }

                $voucherItemIds = $rows->pluck('voucher_item_id')->filter()->unique()->values();
                $voucherItemsById = VoucherItem::query()
                    ->where('organization_id', $organizationId)
                    ->whereIn('id', $voucherItemIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                foreach ($rows as $row) {
                    $remaining = round((float) $row->qty_received - (float) $row->qty_dispatched, 3);
                    if ($remaining < 0.0001) {
                        continue;
                    }

                    $voucherItem = $voucherItemsById->get($row->voucher_item_id);
                    if (! $voucherItem) {
                        throw ValidationException::withMessages([
                            'action_type' => ['One or more voucher lines could not be loaded for dispatch.'],
                        ]);
                    }

                    if ($actionType === 'FORWARD_TO_WAREHOUSE') {
                        WarehouseFulfillmentInstruction::query()->create([
                            'organization_id' => $organizationId,
                            'warehouse_id' => $nextWarehouseId,
                            'trip_item_id' => $row->trip_item_id,
                            'voucher_item_id' => $row->voucher_item_id,
                            'merchant_id' => $row->merchant_id,
                            'qty_received' => $remaining,
                            'qty_dispatched' => 0,
                            'status' => 'PENDING_ACTION',
                            'next_action_type' => null,
                            'next_warehouse_id' => null,
                            'note' => 'Forwarded from warehouse ID '.$warehouseId,
                            'last_updated_by' => $actor->id,
                        ]);

                        $row->next_action_type = 'FORWARD_TO_WAREHOUSE';
                        $row->next_warehouse_id = $nextWarehouseId;
                    } else {
                        $row->next_action_type = $actionType;
                    }

                    $row->qty_dispatched = round((float) $row->qty_dispatched + $remaining, 3);
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
                        'qty' => $remaining,
                        'warehouse_id' => $warehouseId,
                        'next_warehouse_id' => $row->next_warehouse_id,
                        'voucher_batch' => true,
                        'voucher_id' => $voucherId,
                    ]);

                    $processed++;
                }

                if ($processed === 0) {
                    throw ValidationException::withMessages([
                        'action_type' => ['There is no remaining quantity to dispatch for this voucher.'],
                    ]);
                }
            });
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors())->withInput();
        }

        return back()->with('success', $processed === 1 ? 'Fulfillment action recorded for 1 line.' : "Fulfillment action recorded for {$processed} lines.");
    }
}
