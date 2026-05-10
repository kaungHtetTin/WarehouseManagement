<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\VoucherPayment;
use App\Support\VoucherLineFreight;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VoucherManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $vouchers = Voucher::query()
            ->where('organization_id', $organizationId)
            ->with([
                'merchant:id,name',
                'sourceWarehouse:id,name,code',
                'items' => function ($q) {
                    $q->orderBy('line_no')->with('product:id,name,unit');
                },
            ])
            ->orderByDesc('voucher_date')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Admin/Operations/VouchersIndex', [
            'vouchers' => $vouchers,
        ]);
    }

    public function show(Request $request, string $voucher): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $model = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->with([
                'merchant:id,name,phone,nrc_or_id,address',
                'sourceWarehouse:id,name,code',
                'defaultToWarehouse:id,name,code',
                'creator:id,name',
                'payments' => fn ($q) => $q->orderByDesc('paid_at')->with('receiver:id,name'),
                'items' => fn ($q) => $q->orderBy('line_no')->with([
                    'product:id,name,unit,sku',
                    'fromWarehouse:id,name,code',
                    'toWarehouse:id,name,code',
                ]),
            ])
            ->firstOrFail();

        abort_if($model->status === 'DRAFT', 404);

        return Inertia::render('Admin/Operations/VoucherDetail', [
            'voucher' => $model,
            'can_record_voucher_payments' => $request->user()->hasPermission('payments.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $this->validateVoucherPayload($request, $organizationId);

        $voucher = DB::transaction(function () use ($actor, $organizationId, $validated) {
            $voucher = Voucher::query()->create([
                'organization_id' => $organizationId,
                'voucher_no' => $this->nextVoucherNo($organizationId),
                'voucher_date' => $validated['voucher_date'],
                'source_warehouse_id' => $validated['source_warehouse_id'],
                'merchant_id' => $validated['merchant_id'],
                'status' => 'DRAFT',
                'payment_status' => $validated['payment_status'] ?? 'UNPAID',
                'total_qty' => 0,
                'total_amount' => $validated['total_amount'] ?? null,
                'remark' => $validated['remark'] ?? null,
                'created_by' => $actor->id,
            ]);

            $this->syncItemsFromValidated($voucher, $organizationId, $validated['items']);
            $this->recalculateTotals($voucher);

            return $voucher;
        });

        AuditLogger::record($actor, 'voucher.create', $voucher, [
            'voucher_no' => $voucher->voucher_no,
            'merchant_id' => $voucher->merchant_id,
        ]);

        return Redirect::route('admin.vouchers.index')->with('success', 'Voucher created successfully.');
    }

    public function update(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveTenantVoucher($actor, $voucher);
        abort_unless($voucherModel->isDraft(), 403);

        $organizationId = $actor->organization_id;
        $validated = $this->validateVoucherPayload($request, $organizationId);

        DB::transaction(function () use ($voucherModel, $organizationId, $validated) {
            $voucherModel->fill([
                'voucher_date' => $validated['voucher_date'],
                'source_warehouse_id' => $validated['source_warehouse_id'],
                'merchant_id' => $validated['merchant_id'],
                'payment_status' => $validated['payment_status'] ?? $voucherModel->payment_status,
                'total_amount' => $validated['total_amount'] ?? null,
                'remark' => $validated['remark'] ?? null,
            ]);
            $voucherModel->save();

            $voucherModel->items()->delete();
            $this->syncItemsFromValidated($voucherModel, $organizationId, $validated['items']);
            $this->recalculateTotals($voucherModel);
        });

        AuditLogger::record($actor, 'voucher.update', $voucherModel, [
            'voucher_no' => $voucherModel->voucher_no,
        ]);

        return Redirect::route('admin.vouchers.index')->with('success', 'Voucher updated successfully.');
    }

    public function destroy(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveTenantVoucher($actor, $voucher);
        abort_unless($voucherModel->isDraft(), 403);

        $snapshot = [
            'voucher_no' => $voucherModel->voucher_no,
        ];
        $voucherModel->delete();

        AuditLogger::record($actor, 'voucher.delete', null, $snapshot);

        return Redirect::route('admin.vouchers.index')->with('success', 'Voucher deleted successfully.');
    }

    public function storePayment(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('payments.manage'), 403);

        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherModel = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);

        if ($request->input('voucher_item_id') === '' || $request->input('voucher_item_id') === null) {
            $request->merge(['voucher_item_id' => null]);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['nullable', 'string', 'max:8'],
            'payment_method' => ['required', Rule::in(['CASH', 'TRANSFER', 'OTHER'])],
            'paid_at' => ['required', 'date'],
            'reference_no' => ['nullable', 'string', 'max:128'],
            'note' => ['nullable', 'string', 'max:2000'],
            'voucher_item_id' => [
                'nullable',
                'integer',
                Rule::exists('voucher_items', 'id')->where(fn ($q) => $q
                    ->where('organization_id', $organizationId)
                    ->where('voucher_id', $voucherModel->id)),
            ],
        ]);

        DB::transaction(function () use ($validated, $organizationId, $voucherModel, $actor) {
            VoucherPayment::query()->create([
                'organization_id' => $organizationId,
                'voucher_id' => $voucherModel->id,
                'voucher_item_id' => $validated['voucher_item_id'] ?? null,
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

            $this->recomputeVoucherPaymentStatus($voucherModel->fresh());
            $this->recomputeVoucherItemPaymentStatuses($voucherModel->fresh());
        });

        AuditLogger::record($actor, 'voucher.payment.record', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'amount' => round((float) $validated['amount'], 2),
            'payment_method' => $validated['payment_method'],
        ]);

        return Redirect::route('admin.vouchers.show', $voucherModel)
            ->with('success', 'Payment recorded.');
    }

    private function recomputeVoucherPaymentStatus(Voucher $voucher): void
    {
        if ($voucher->payment_status === 'WAIVED') {
            return;
        }

        if ($voucher->total_amount === null) {
            return;
        }

        $total = round((float) $voucher->total_amount, 2);
        $paid = round((float) VoucherPayment::query()
            ->where('voucher_id', $voucher->id)
            ->where('organization_id', $voucher->organization_id)
            ->sum('amount'), 2);

        if ($paid <= 0.005) {
            $next = 'UNPAID';
        } elseif ($paid + 0.005 >= $total) {
            $next = 'PAID';
        } else {
            $next = 'PARTIAL';
        }

        if ($voucher->payment_status !== $next) {
            $voucher->payment_status = $next;
            $voucher->save();
        }
    }

    private function recomputeVoucherItemPaymentStatuses(Voucher $voucher): void
    {
        $items = VoucherItem::query()
            ->where('organization_id', $voucher->organization_id)
            ->where('voucher_id', $voucher->id)
            ->get();

        foreach ($items as $item) {
            if ($item->payment_status === 'WAIVED') {
                continue;
            }
            $lineTotal = $item->freight_amount !== null ? round((float) $item->freight_amount, 2) : null;
            if ($lineTotal === null || $lineTotal <= 0.0) {
                continue;
            }

            $paid = round((float) VoucherPayment::query()
                ->where('organization_id', $voucher->organization_id)
                ->where('voucher_id', $voucher->id)
                ->where('voucher_item_id', $item->id)
                ->sum('amount'), 2);

            if ($paid <= 0.005) {
                $next = 'UNPAID';
            } elseif ($paid + 0.005 >= $lineTotal) {
                $next = 'PAID';
            } else {
                $next = 'PARTIAL';
            }

            if ($item->payment_status !== $next) {
                $item->payment_status = $next;
                $item->save();
            }
        }
    }

    private function validateVoucherPayload(Request $request, int $organizationId): array
    {
        return $request->validate([
            'voucher_date' => ['required', 'date'],
            'source_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'merchant_id' => [
                'required',
                Rule::exists('merchants', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'payment_status' => ['sometimes', Rule::in(['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required',
                Rule::exists('products', 'id')->where(
                    fn ($q) => $q->where('organization_id', $organizationId)->whereNull('deleted_at')
                ),
            ],
            'items.*.from_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'items.*.to_warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'items.*.to_city' => ['required', 'string', 'max:128'],
            'items.*.to_address_line1' => ['required', 'string', 'max:500'],
            'items.*.to_address_line2' => ['nullable', 'string', 'max:500'],
            'items.*.to_township' => ['nullable', 'string', 'max:128'],
            'items.*.to_region' => ['nullable', 'string', 'max:128'],
            'items.*.to_postal_code' => ['nullable', 'string', 'max:32'],
            'items.*.recipient_name' => ['nullable', 'string', 'max:255'],
            'items.*.recipient_phone' => ['nullable', 'string', 'max:64'],
            'items.*.qty' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit' => ['required', 'string', 'max:32'],
            'items.*.description' => ['nullable', 'string', 'max:500'],
            'items.*.freight_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.freight_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.payment_status' => ['sometimes', Rule::in(['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])],
            'items.*.is_fragile' => ['sometimes', 'boolean'],
        ]);
    }

    private function syncItemsFromValidated(Voucher $voucher, int $organizationId, array $items): void
    {
        $lineNo = 1;
        foreach ($items as $row) {
            $qty = (float) $row['qty'];
            $freightAmount = VoucherLineFreight::resolveAmount(
                $qty,
                $row['freight_rate'] ?? null,
                $row['freight_amount'] ?? null,
            );
            VoucherItem::query()->create([
                'organization_id' => $organizationId,
                'voucher_id' => $voucher->id,
                'line_no' => $lineNo++,
                'product_id' => $row['product_id'],
                'description' => $row['description'] ?? null,
                'from_warehouse_id' => $row['from_warehouse_id'],
                'to_warehouse_id' => $row['to_warehouse_id'] ?? null,
                'to_city' => $row['to_city'],
                'to_address_line1' => $row['to_address_line1'],
                'to_address_line2' => $row['to_address_line2'] ?? null,
                'to_township' => $row['to_township'] ?? null,
                'to_region' => $row['to_region'] ?? null,
                'to_postal_code' => $row['to_postal_code'] ?? null,
                'recipient_name' => $row['recipient_name'] ?? null,
                'recipient_phone' => $row['recipient_phone'] ?? null,
                'qty' => $row['qty'],
                'loaded_qty' => 0,
                'delivered_qty' => 0,
                'unit' => $row['unit'],
                'freight_rate' => $row['freight_rate'] ?? null,
                'freight_amount' => $freightAmount,
                'payment_status' => $row['payment_status'] ?? 'UNPAID',
                'is_fragile' => (bool) ($row['is_fragile'] ?? false),
            ]);
        }
    }

    private function recalculateTotals(Voucher $voucher): void
    {
        $voucher->load('items');
        $totalQty = $voucher->items->sum(fn (VoucherItem $i) => (float) $i->qty);
        $freightSum = $voucher->items->sum(fn (VoucherItem $i) => (float) ($i->freight_amount ?? 0));
        $voucher->total_qty = $totalQty;
        if ($voucher->total_amount === null && $freightSum > 0) {
            $voucher->total_amount = $freightSum;
        }
        $voucher->save();
    }

    private function nextVoucherNo(int $organizationId): string
    {
        do {
            $no = 'V-'.strtoupper(Str::ulid());
        } while (Voucher::query()->where('organization_id', $organizationId)->where('voucher_no', $no)->exists());

        return $no;
    }

    private function resolveTenantVoucher(User $user, string $voucherId): Voucher
    {
        abort_if($user->organization_id === null, 404);

        return Voucher::query()
            ->whereKey($voucherId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }
}
