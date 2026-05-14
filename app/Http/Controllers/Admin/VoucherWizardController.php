<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Merchant;
use App\Models\Product;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\VoucherLineFreight;
use App\Services\Audit\AuditLogger;
use App\Services\Inventory\StockLedgerService;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VoucherWizardController extends Controller
{
    public function __construct(
        private StockLedgerService $stockLedger,
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function create(Request $request): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $voucherId = $request->query('voucher');
        $voucher = null;
        if ($voucherId !== null && $voucherId !== '') {
            $voucher = $this->draftVoucherForWizard($organizationId, $voucherId);
        }

        return $this->renderWizardPage($request, $voucher);
    }

    public function edit(Request $request, string $voucher): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $model = $this->draftVoucherForWizard($organizationId, $voucher);
        abort_if($model === null, 404);

        return $this->renderWizardPage($request, $model);
    }

    private function draftVoucherForWizard(int $organizationId, string $voucherId): ?Voucher
    {
        return Voucher::query()
            ->where('organization_id', $organizationId)
            ->whereKey($voucherId)
            ->where('status', 'DRAFT')
            ->with([
                'merchant:id,name,phone,nrc_or_id,address',
                'sourceWarehouse:id,name,code',
                'items' => fn ($q) => $q->orderBy('line_no')->with([
                    'product:id,name,unit,sku',
                    'fromWarehouse:id,name,code',
                ]),
            ])
            ->first();
    }

    private function renderWizardPage(Request $request, ?Voucher $voucher): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        return Inertia::render('Admin/Operations/VoucherWizard', [
            'voucher' => $voucher,
            'warehouses' => $this->operationalContext->assignedWarehousesOnly($request->user()),
            'categories' => Category::query()
                ->where('organization_id', $organizationId)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function merchantMatches(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $phone = (string) $request->query('phone', '');
        $digits = $this->normalizePhoneDigits($phone);
        if ($digits === '') {
            return response()->json(['matches' => []]);
        }

        $merchants = Merchant::query()
            ->where('organization_id', $organizationId)
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->orderBy('name')
            ->limit(500)
            ->get(['id', 'name', 'phone', 'nrc_or_id', 'address']);

        $matches = $merchants
            ->filter(fn (Merchant $m) => $this->normalizePhoneDigits($m->phone) === $digits)
            ->values()
            ->all();

        return response()->json(['matches' => $matches]);
    }

    public function productSearch(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 1) {
            return response()->json(['results' => []]);
        }

        $like = '%'.addcslashes($q, '%_\\').'%';

        $results = Product::query()
            ->where('organization_id', $organizationId)
            ->whereNull('deleted_at')
            ->where('status', 'ACTIVE')
            ->where(function ($query) use ($like) {
                $query->where('name', 'like', $like)
                    ->orWhere('sku', 'like', $like);
            })
            ->orderBy('name')
            ->limit(25)
            ->get(['id', 'name', 'unit', 'sku', 'category_id']);

        return response()->json(['results' => $results]);
    }

    public function storeStep1(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate(array_merge([
            'voucher_date' => ['required', 'date'],
            'source_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'remark' => ['nullable', 'string', 'max:2000'],
            'merchant_id' => [
                'nullable',
                Rule::exists('merchants', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'merchant' => ['required', 'array'],
            'merchant.name' => ['required', 'string', 'max:255'],
            'merchant.phone' => ['nullable', 'string', 'max:64'],
            'merchant.nrc_or_id' => ['nullable', 'string', 'max:128'],
            'merchant.address' => ['nullable', 'string', 'max:500'],
            'payment_status' => ['sometimes', Rule::in(['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])],
        ], $this->rulesWizardDefaultDestination($organizationId), $this->rulesWizardMeta()));

        $voucher = DB::transaction(function () use ($actor, $organizationId, $validated) {
            $merchantId = $validated['merchant_id'] ?? null;
            if ($merchantId === null) {
                $merchant = Merchant::query()->create([
                    'organization_id' => $organizationId,
                    'name' => $validated['merchant']['name'],
                    'phone' => $validated['merchant']['phone'] ?? null,
                    'nrc_or_id' => $validated['merchant']['nrc_or_id'] ?? null,
                    'address' => $validated['merchant']['address'] ?? null,
                ]);
                AuditLogger::record($actor, 'merchant.create', $merchant, ['name' => $merchant->name, 'context' => 'voucher_wizard']);
                $merchantId = $merchant->id;
            } else {
                $merchant = Merchant::query()
                    ->whereKey($merchantId)
                    ->where('organization_id', $organizationId)
                    ->firstOrFail();
                $merchant->fill([
                    'name' => $validated['merchant']['name'] ?? $merchant->name,
                    'phone' => array_key_exists('phone', $validated['merchant'] ?? []) ? ($validated['merchant']['phone'] ?? null) : $merchant->phone,
                    'nrc_or_id' => $validated['merchant']['nrc_or_id'] ?? $merchant->nrc_or_id,
                    'address' => $validated['merchant']['address'] ?? $merchant->address,
                ]);
                $merchant->save();
                AuditLogger::record($actor, 'merchant.update', $merchant, ['name' => $merchant->name, 'context' => 'voucher_wizard']);
            }

            $voucher = Voucher::query()->create(array_merge([
                'organization_id' => $organizationId,
                'voucher_no' => $this->nextVoucherNo($organizationId),
                'voucher_date' => $validated['voucher_date'],
                'source_warehouse_id' => $validated['source_warehouse_id'],
                'merchant_id' => $merchantId,
                'status' => 'DRAFT',
                'payment_status' => $validated['payment_status'] ?? 'UNPAID',
                'total_qty' => 0,
                'total_amount' => null,
                'remark' => $validated['remark'] ?? null,
                'created_by' => $actor->id,
            ], $this->payloadWizardDefaultDestination($validated), $this->payloadWizardMeta($validated)));

            $this->recalculateTotals($voucher);

            AuditLogger::record($actor, 'voucher.create', $voucher, [
                'voucher_no' => $voucher->voucher_no,
                'context' => 'voucher_wizard_step1',
            ]);

            return $voucher;
        });

        $url = route('admin.vouchers.wizard.edit', $voucher).'?tab=lines';

        return Redirect::to($url)
            ->with('success', 'Draft voucher saved. Add product lines.');
    }

    public function updateStep1(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveDraftVoucher($actor, $voucher);
        $organizationId = $actor->organization_id;

        $validated = $request->validate(array_merge([
            'voucher_date' => ['required', 'date'],
            'source_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'remark' => ['nullable', 'string', 'max:2000'],
            'merchant_id' => [
                'required',
                Rule::exists('merchants', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'merchant' => ['required', 'array'],
            'merchant.name' => ['required', 'string', 'max:255'],
            'merchant.phone' => ['nullable', 'string', 'max:64'],
            'merchant.nrc_or_id' => ['nullable', 'string', 'max:128'],
            'merchant.address' => ['nullable', 'string', 'max:500'],
            'payment_status' => ['sometimes', Rule::in(['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])],
        ], $this->rulesWizardDefaultDestination($organizationId), $this->rulesWizardMeta()));

        DB::transaction(function () use ($actor, $voucherModel, $organizationId, $validated) {
            $merchant = Merchant::query()
                ->whereKey($validated['merchant_id'])
                ->where('organization_id', $organizationId)
                ->firstOrFail();

            $merchant->fill([
                'name' => $validated['merchant']['name'],
                'phone' => $validated['merchant']['phone'] ?? null,
                'nrc_or_id' => $validated['merchant']['nrc_or_id'] ?? null,
                'address' => $validated['merchant']['address'] ?? null,
            ]);
            $merchant->save();
            AuditLogger::record($actor, 'merchant.update', $merchant, ['name' => $merchant->name, 'context' => 'voucher_wizard']);

            $voucherModel->fill(array_merge([
                'voucher_date' => $validated['voucher_date'],
                'source_warehouse_id' => $validated['source_warehouse_id'],
                'merchant_id' => $merchant->id,
                'remark' => $validated['remark'] ?? null,
                'payment_status' => $validated['payment_status'] ?? $voucherModel->payment_status,
            ], $this->payloadWizardDefaultDestination($validated), $this->payloadWizardMeta($validated)));
            $voucherModel->save();

            $this->recalculateTotals($voucherModel);

            AuditLogger::record($actor, 'voucher.update', $voucherModel, [
                'voucher_no' => $voucherModel->voucher_no,
                'context' => 'voucher_wizard_step1',
            ]);
        });

        return Redirect::route('admin.vouchers.wizard.edit', $voucherModel)
            ->with('success', 'Voucher details updated.');
    }

    public function storeLine(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveDraftVoucher($actor, $voucher);
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'product_id' => [
                'nullable',
                Rule::exists('products', 'id')->where(
                    fn ($q) => $q->where('organization_id', $organizationId)->whereNull('deleted_at')
                ),
            ],
            'new_product' => ['nullable', 'array'],
            'new_product.name' => ['required_with:new_product', 'string', 'max:255'],
            'new_product.unit' => ['required_with:new_product', 'string', 'max:32'],
            'new_product.sku' => ['nullable', 'string', 'max:128'],
            'new_product.category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'qty' => ['required', 'numeric', 'min:0.001'],
            'unit' => ['required', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:500'],
            'freight_rate' => ['nullable', 'numeric', 'min:0'],
            'freight_amount' => ['nullable', 'numeric', 'min:0'],
            'is_fragile' => ['sometimes', 'boolean'],
        ]);

        $hasProductId = filled($validated['product_id'] ?? null);
        $hasNewProduct = isset($validated['new_product']) && is_array($validated['new_product'])
            && filled($validated['new_product']['name'] ?? null);

        if (! $hasProductId && ! $hasNewProduct) {
            return Redirect::back()->with('error', 'Select an existing product or provide new product details.');
        }

        $qty = (float) $validated['qty'];
        $freightAmount = VoucherLineFreight::resolveAmount(
            $qty,
            $validated['freight_rate'] ?? null,
            $validated['freight_amount'] ?? null,
        );

        DB::transaction(function () use ($actor, $voucherModel, $organizationId, $validated, $hasProductId, $hasNewProduct, $freightAmount) {
            $productId = $hasProductId ? (int) $validated['product_id'] : null;
            if ($productId === null && $hasNewProduct) {
                $np = $validated['new_product'];
                $sku = isset($np['sku']) ? trim((string) $np['sku']) : null;
                $sku = $sku === '' ? null : $sku;

                $product = Product::query()->create([
                    'organization_id' => $organizationId,
                    'category_id' => $np['category_id'] ?? null,
                    'sku' => $sku,
                    'name' => $np['name'],
                    'unit' => $np['unit'],
                    'default_weight' => null,
                    'status' => 'ACTIVE',
                ]);
                AuditLogger::record($actor, 'product.create', $product, [
                    'name' => $product->name,
                    'context' => 'voucher_wizard',
                ]);
                $productId = $product->id;
            }

            $nextLine = (int) (VoucherItem::query()->where('voucher_id', $voucherModel->id)->max('line_no') ?? 0) + 1;

            VoucherItem::query()->create([
                'organization_id' => $organizationId,
                'voucher_id' => $voucherModel->id,
                'line_no' => $nextLine,
                'product_id' => $productId,
                'description' => $validated['description'] ?? null,
                'from_warehouse_id' => $voucherModel->source_warehouse_id,
                'qty' => $validated['qty'],
                'loaded_qty' => 0,
                'delivered_qty' => 0,
                'unit' => $validated['unit'],
                'freight_rate' => $validated['freight_rate'] ?? null,
                'freight_amount' => $freightAmount,
                'is_fragile' => (bool) ($validated['is_fragile'] ?? false),
            ]);

            $this->recalculateTotals($voucherModel);
            AuditLogger::record($actor, 'voucher_item.create', $voucherModel, [
                'voucher_no' => $voucherModel->voucher_no,
                'line_no' => $nextLine,
                'product_id' => $productId,
            ]);
        });

        return Redirect::route('admin.vouchers.wizard.edit', $voucherModel)
            ->with('success', 'Line added.');
    }

    public function destroyLine(Request $request, string $voucher, string $voucherItem): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveDraftVoucher($actor, $voucher);
        $organizationId = $actor->organization_id;

        $item = VoucherItem::query()
            ->whereKey($voucherItem)
            ->where('voucher_id', $voucherModel->id)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        $item->delete();
        $this->renumberLines($voucherModel);
        $this->recalculateTotals($voucherModel->fresh());

        AuditLogger::record($actor, 'voucher_item.delete', $voucherModel, [
            'voucher_no' => $voucherModel->voucher_no,
            'voucher_item_id' => (int) $voucherItem,
        ]);

        return Redirect::route('admin.vouchers.wizard.edit', $voucherModel)
            ->with('success', 'Line removed.');
    }

    public function finish(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $voucherModel = $this->resolveDraftVoucher($actor, $voucher);
        $voucherModel->loadCount('items');
        if ($voucherModel->items_count < 1) {
            return Redirect::back()->with('error', 'Add at least one line before confirming.');
        }

        $validated = $request->validate([
            'payment_status' => ['nullable', Rule::in(['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])],
            'remark' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($voucherModel, $actor, $validated) {
            $voucherModel->refresh();
            abort_unless($voucherModel->isDraft(), 403);
            if (array_key_exists('payment_status', $validated) && $validated['payment_status'] !== null) {
                $voucherModel->payment_status = $validated['payment_status'];
            }
            if (array_key_exists('remark', $validated)) {
                $voucherModel->remark = $validated['remark'] ?? null;
            }
            $voucherModel->save();
            $this->recalculateTotals($voucherModel);
            $voucherModel->forceFill(['status' => 'CONFIRMED'])->save();
            $voucherModel->load('items');
            foreach ($voucherModel->items as $line) {
                $this->stockLedger->recordIntakeForVoucherItem($line, $actor);
            }

            if ($voucherModel->payment_status === 'PAID' && $voucherModel->total_amount !== null) {
                $total = round((float) $voucherModel->total_amount, 2);
                if ($total > 0) {
                    \App\Models\VoucherPayment::query()->create([
                        'organization_id' => $voucherModel->organization_id,
                        'voucher_id' => $voucherModel->id,
                        'amount' => $total,
                        'currency' => 'MMK',
                        'payment_method' => 'CASH',
                        'paid_at' => now(),
                        'reference_no' => null,
                        'note' => 'Auto-recorded upon voucher confirmation.',
                        'received_by' => $actor->id,
                    ]);
                }
            }
        });

        AuditLogger::record($actor, 'voucher.confirm', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'status_from' => 'DRAFT',
            'status_to' => 'CONFIRMED',
        ]);

        return Redirect::route('admin.vouchers.index')
            ->with('success', 'Voucher confirmed. It appears as Confirmed in the list and can no longer be edited in the wizard.');
    }

    private function resolveDraftVoucher(User $user, string $voucherId): Voucher
    {
        abort_if($user->organization_id === null, 404);

        $voucher = Voucher::query()
            ->whereKey($voucherId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();

        abort_unless($voucher->isDraft(), 403);

        return $voucher;
    }

    private function rulesWizardDefaultDestination(int $organizationId): array
    {
        return [
            'default_to_warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'default_to_city' => ['required', 'string', 'max:128'],
            'default_to_address_line1' => ['required', 'string', 'max:500'],
            'default_to_address_line2' => ['nullable', 'string', 'max:500'],
            'default_to_township' => ['nullable', 'string', 'max:128'],
            'default_to_region' => ['nullable', 'string', 'max:128'],
            'default_to_postal_code' => ['nullable', 'string', 'max:32'],
            'default_recipient_name' => ['nullable', 'string', 'max:255'],
            'default_recipient_phone' => ['nullable', 'string', 'max:64'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function payloadWizardDefaultDestination(array $validated): array
    {
        return [
            'default_to_warehouse_id' => $validated['default_to_warehouse_id'] ?? null,
            'default_to_city' => $validated['default_to_city'],
            'default_to_address_line1' => $validated['default_to_address_line1'],
            'default_to_address_line2' => $validated['default_to_address_line2'] ?? null,
            'default_to_township' => $validated['default_to_township'] ?? null,
            'default_to_region' => $validated['default_to_region'] ?? null,
            'default_to_postal_code' => $validated['default_to_postal_code'] ?? null,
            'default_recipient_name' => $validated['default_recipient_name'] ?? null,
            'default_recipient_phone' => $validated['default_recipient_phone'] ?? null,
        ];
    }

    private function rulesWizardMeta(): array
    {
        return [
            'total_weight' => ['nullable', 'numeric', 'min:0'],
            'additional_costs' => ['nullable', 'array', 'max:50'],
            'additional_costs.*.label' => ['required_with:additional_costs.*.amount', 'string', 'max:255'],
            'additional_costs.*.amount' => ['required_with:additional_costs.*.label', 'numeric', 'min:0'],
        ];
    }

    private function payloadWizardMeta(array $validated): array
    {
        $raw = $validated['additional_costs'] ?? null;
        $normalized = [];
        if (is_array($raw)) {
            foreach ($raw as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $label = trim((string) ($row['label'] ?? ''));
                $amountRaw = $row['amount'] ?? null;

                $hasAmount = $amountRaw !== null && $amountRaw !== '';
                $amount = $hasAmount ? (float) $amountRaw : null;

                if ($label === '' && $amount === null) {
                    continue;
                }
                if ($label === '' || $amount === null) {
                    continue;
                }

                $normalized[] = [
                    'label' => $label,
                    'amount' => round((float) $amount, 2),
                ];
            }
        }

        return [
            'total_weight' => $validated['total_weight'] ?? null,
            'additional_costs' => $normalized === [] ? null : $normalized,
        ];
    }

    private function normalizePhoneDigits(?string $phone): string
    {
        return preg_replace('/\D+/', '', (string) $phone);
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

    private function renumberLines(Voucher $voucher): void
    {
        $items = VoucherItem::query()
            ->where('voucher_id', $voucher->id)
            ->orderBy('id')
            ->get();

        $line = 1;
        foreach ($items as $row) {
            if ((int) $row->line_no !== $line) {
                $row->line_no = $line;
                $row->save();
            }
            $line++;
        }
    }
}
