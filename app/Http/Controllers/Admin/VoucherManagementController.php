<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
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
        abort_if($voucherModel->payment_status === 'WAIVED', 422, 'Cannot add payments to a waived voucher.');
        abort_if($voucherModel->total_amount === null, 422, 'Cannot add payments when total amount is not set.');

        $total = $voucherModel->total_amount !== null ? round((float) $voucherModel->total_amount, 2) : 0.0;
        $paid = round((float) VoucherPayment::query()
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
            VoucherPayment::query()->create([
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

            $this->recomputeVoucherPaymentStatus($voucherModel->fresh());
        });

        AuditLogger::record($actor, 'voucher.payment.record', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'amount' => round((float) $validated['amount'], 2),
            'payment_method' => $validated['payment_method'],
        ]);

        return Redirect::route('admin.vouchers.show', $voucherModel)
            ->with('success', 'Payment recorded.');
    }

    public function setWaived(Request $request, string $voucher): RedirectResponse
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

        $validated = $request->validate([
            'waived' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($validated, $voucherModel, $organizationId, $actor) {
            $voucherModel->refresh();

            $paid = round((float) VoucherPayment::query()
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

            $this->recomputeVoucherPaymentStatus($voucherModel->fresh());
        });

        AuditLogger::record($actor, 'voucher.payment.waive', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'waived' => (bool) $validated['waived'],
        ]);

        return Redirect::back()->with('success', 'Payment status updated.');
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
            'items.*.qty' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit' => ['required', 'string', 'max:32'],
            'items.*.description' => ['nullable', 'string', 'max:500'],
            'items.*.freight_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.freight_amount' => ['nullable', 'numeric', 'min:0'],
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
                'qty' => $row['qty'],
                'loaded_qty' => 0,
                'delivered_qty' => 0,
                'unit' => $row['unit'],
                'freight_rate' => $row['freight_rate'] ?? null,
                'freight_amount' => $freightAmount,
                'is_fragile' => (bool) ($row['is_fragile'] ?? false),
            ]);
        }
    }

    private function recalculateTotals(Voucher $voucher): void
    {
        $voucher->load('items');
        $totalQty = $voucher->items->sum(fn (VoucherItem $i) => (float) $i->qty);
        $freightSum = $voucher->items->sum(fn (VoucherItem $i) => (float) ($i->freight_amount ?? 0));

        $productWeights = Product::query()
            ->where('organization_id', $voucher->organization_id)
            ->whereIn('id', $voucher->items->pluck('product_id')->all())
            ->pluck('default_weight', 'id');

        $totalWeight = $voucher->items->sum(function (VoucherItem $i) use ($productWeights) {
            $w = $productWeights->get($i->product_id);
            if ($w === null) {
                return 0;
            }
            return (float) $i->qty * (float) $w;
        });

        $costSum = 0.0;
        $costs = $voucher->additional_costs;
        if (is_array($costs)) {
            foreach ($costs as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $a = $row['amount'] ?? null;
                if ($a === null || $a === '') {
                    continue;
                }
                $n = (float) $a;
                if ($n > 0) {
                    $costSum += $n;
                }
            }
        }

        $voucher->total_qty = $totalQty;
        if ($voucher->total_weight === null) {
            $voucher->total_weight = round((float) $totalWeight, 3);
        }

        $computedTotal = round((float) $freightSum + (float) $costSum, 2);
        $voucher->total_amount = $computedTotal > 0.0001 ? $computedTotal : null;
        $voucher->save();
    }

    private function base36(int $value): string
    {
        if ($value <= 0) {
            return '0';
        }

        $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $out = '';
        while ($value > 0) {
            $out = $alphabet[$value % 36].$out;
            $value = intdiv($value, 36);
        }

        return $out;
    }

    private function shortNoSuffix(): string
    {
        $ms = (int) floor(microtime(true) * 1000);
        $time = $this->base36($ms);
        $time = str_pad($time, 8, '0', STR_PAD_LEFT);
        $time = substr($time, -8);

        return $time.strtoupper(Str::random(3));
    }

    private function nextVoucherNo(int $organizationId): string
    {
        do {
            $no = 'V-'.$this->shortNoSuffix();
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
