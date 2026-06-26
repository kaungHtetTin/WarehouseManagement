<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationPublicPage;
use App\Models\Product;
use App\Models\TripItem;
use App\Models\User;
use App\Models\VoucherAdditionalCostCategory;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\VoucherPayment;
use App\Support\VoucherLineFreight;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class VoucherManagementController extends Controller
{
    public function __construct(
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->organizationWarehouses($user);
        $allowedWarehouseIds = $this->operationalContext->organizationWarehouseIds($user);

        $rawWarehouseFilter = (string) $request->query('destination_warehouse_id', 'all');
        $warehouseFilter = 'all';
        if ($rawWarehouseFilter !== '' && $rawWarehouseFilter !== 'all') {
            $candidate = (int) $rawWarehouseFilter;
            if (in_array($candidate, $allowedWarehouseIds, true)) {
                $warehouseFilter = (string) $candidate;
            }
        }

        $rawSourceWarehouseFilter = (string) $request->query('source_warehouse_id', 'all');
        $sourceWarehouseFilter = 'all';
        if ($rawSourceWarehouseFilter !== '' && $rawSourceWarehouseFilter !== 'all') {
            $candidate = (int) $rawSourceWarehouseFilter;
            if (in_array($candidate, $allowedWarehouseIds, true)) {
                $sourceWarehouseFilter = (string) $candidate;
            }
        }

        $rawPaymentFilter = (string) $request->query('payment_status', 'all');
        $paymentFilter = in_array($rawPaymentFilter, ['UNPAID', 'PARTIAL', 'PAID', 'WAIVED', 'all'], true) ? $rawPaymentFilter : 'all';

        $rawStatusFilter = (string) $request->query('status', 'all');
        $statusFilter = in_array($rawStatusFilter, ['all', 'confirmed', 'loading', 'in_transit', 'delivered'], true)
            ? $rawStatusFilter
            : 'all';
        $searchFilter = trim((string) $request->query('search', ''));
        $rawVoucherDateFilter = trim((string) $request->query('voucher_date', ''));
        $voucherDateFilter = preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawVoucherDateFilter) === 1
            ? $rawVoucherDateFilter
            : '';
        $perPage = (int) $request->query('per_page', 25);
        if (! in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }

        $query = Voucher::query()
            ->where('organization_id', $organizationId);

        if ($warehouseFilter !== 'all') {
            $query->where('default_to_warehouse_id', (int) $warehouseFilter);
        } elseif ($allowedWarehouseIds === []) {
            $query->whereRaw('1 = 0');
        } else {
            $query->whereIn('default_to_warehouse_id', $allowedWarehouseIds);
        }

        if ($paymentFilter !== 'all') {
            $query->where('payment_status', $paymentFilter);
        }

        if ($sourceWarehouseFilter !== 'all') {
            $query->where('source_warehouse_id', (int) $sourceWarehouseFilter);
        }

        if ($searchFilter !== '') {
            $query->where(function ($q) use ($searchFilter) {
                $like = '%'.$searchFilter.'%';
                $q->where('voucher_no', 'like', $like)
                    ->orWhere('default_recipient_name', 'like', $like)
                    ->orWhere('default_recipient_phone', 'like', $like);
            });
        }

        if ($voucherDateFilter !== '') {
            $query->whereDate('voucher_date', $voucherDateFilter);
        }

        if ($statusFilter === 'delivered') {
            $query->whereIn('status', ['DELIVERED', 'CLOSED']);
        } elseif ($statusFilter === 'loading') {
            $query
                ->whereNotIn('status', ['DELIVERED', 'CLOSED'])
                ->whereExists(function ($q) use ($organizationId) {
                    $q->selectRaw('1')
                        ->from('trip_items as ti')
                        ->join('voucher_items as vi', function ($j) use ($organizationId) {
                            $j->on('vi.id', '=', 'ti.voucher_item_id')
                                ->where('vi.organization_id', '=', $organizationId);
                        })
                        ->join('trips as t', function ($j) use ($organizationId) {
                            $j->on('t.id', '=', 'ti.trip_id')
                                ->where('t.organization_id', '=', $organizationId);
                        })
                        ->where('ti.organization_id', $organizationId)
                        ->whereColumn('vi.voucher_id', 'vouchers.id')
                        ->whereIn('t.status', ['PLANNED', 'LOADING']);
                });
        } elseif ($statusFilter === 'in_transit') {
            $query
                ->whereNotIn('status', ['DELIVERED', 'CLOSED'])
                ->whereExists(function ($q) use ($organizationId) {
                    $q->selectRaw('1')
                        ->from('trip_items as ti')
                        ->join('voucher_items as vi', function ($j) use ($organizationId) {
                            $j->on('vi.id', '=', 'ti.voucher_item_id')
                                ->where('vi.organization_id', '=', $organizationId);
                        })
                        ->join('trips as t', function ($j) use ($organizationId) {
                            $j->on('t.id', '=', 'ti.trip_id')
                                ->where('t.organization_id', '=', $organizationId);
                        })
                        ->where('ti.organization_id', $organizationId)
                        ->whereColumn('vi.voucher_id', 'vouchers.id')
                        ->whereIn('t.status', ['DEPARTED', 'AT_STOP']);
                });
        } elseif ($statusFilter === 'confirmed') {
            $query
                ->where('status', 'CONFIRMED')
                ->whereNotExists(function ($q) use ($organizationId) {
                    $q->selectRaw('1')
                        ->from('trip_items as ti')
                        ->join('voucher_items as vi', function ($j) use ($organizationId) {
                            $j->on('vi.id', '=', 'ti.voucher_item_id')
                                ->where('vi.organization_id', '=', $organizationId);
                        })
                        ->join('trips as t', function ($j) use ($organizationId) {
                            $j->on('t.id', '=', 'ti.trip_id')
                                ->where('t.organization_id', '=', $organizationId);
                        })
                        ->where('ti.organization_id', $organizationId)
                        ->whereColumn('vi.voucher_id', 'vouchers.id')
                        ->whereIn('t.status', ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP']);
                });
        }

        $summary = [
            'action_needed' => (clone $query)
                ->where('status', '!=', 'DRAFT')
                ->whereIn('payment_status', ['UNPAID', 'PARTIAL'])
                ->count(),
            'drafts' => (clone $query)->where('status', 'DRAFT')->count(),
            'delivered' => (clone $query)->whereIn('status', ['DELIVERED', 'CLOSED'])->count(),
        ];

        $vouchers = $query
            ->with([
                'merchant:id,name',
                'sourceWarehouse:id,city,address',
                'defaultToWarehouse:id,city,address',
                'items' => function ($q) {
                    $q->orderBy('line_no')->with('product:id,name,unit');
                },
            ])
            ->orderByDesc('voucher_date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/Operations/VouchersIndex', [
            'vouchers' => $vouchers,
            'warehouses' => $warehouses,
            'voucher_warehouse_filter' => $warehouseFilter,
            'voucher_source_warehouse_filter' => $sourceWarehouseFilter,
            'voucher_payment_filter' => $paymentFilter,
            'voucher_status_filter' => $statusFilter,
            'voucher_search_filter' => $searchFilter,
            'voucher_date_filter' => $voucherDateFilter,
            'voucher_summary' => $summary,
        ]);
    }

    public function show(Request $request, string $voucher): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $user = $request->user();

        $model = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->with([
                'merchant:id,name,phone,nrc_or_id,address',
                'sourceWarehouse:id,city,address',
                'defaultToWarehouse:id,city,address',
                'creator:id,name',
                'payments' => fn ($q) => $q->orderByDesc('paid_at')->with('receiver:id,name'),
                'items' => fn ($q) => $q->orderBy('line_no')->with([
                    'product:id,name,unit,sku',
                    'fromWarehouse:id,city,address',
                ]),
            ])
            ->firstOrFail();

        abort_if($model->status === 'DRAFT', 404);

        return Inertia::render('Admin/Operations/VoucherDetail', [
            'voucher' => $model,
            'can_record_voucher_payments' => $user->hasPermission('payments.manage'),
            'can_manage_voucher_details' => $user->hasPermission('vouchers.manage'),
            'can_manage_voucher_lines' => $user->hasPermission('vouchers.manage'),
            'warehouses' => $this->operationalContext->accessibleWarehousesForUi($user)->values(),
            'additional_cost_categories' => VoucherAdditionalCostCategory::query()
                ->where('organization_id', $organizationId)
                ->where('status', 'ACTIVE')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'status', 'sort_order'])
                ->values(),
        ]);
    }

    public function print(Request $request, string $voucher): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $model = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->with([
                'merchant:id,name,phone,nrc_or_id,address',
                'sourceWarehouse:id,city,address',
                'defaultToWarehouse:id,city,address',
                'creator:id,name',
                'payments' => fn ($q) => $q
                    ->orderByDesc('paid_at')
                    ->select(['id', 'organization_id', 'voucher_id', 'amount', 'currency', 'paid_at']),
                'items' => fn ($q) => $q->orderBy('line_no')->with([
                    'product:id,name,unit,sku',
                    'fromWarehouse:id,city,address',
                ]),
            ])
            ->firstOrFail();

        $organization = Organization::query()
            ->whereKey($organizationId)
            ->firstOrFail();

        $page = OrganizationPublicPage::query()->firstOrCreate(
            ['organization_id' => $organizationId],
            [
                'slug' => $organization->code,
                'is_published' => false,
                'business_name' => $organization->name,
            ],
        );

        $templateDefaults = [
            'paper_size' => 'A4',
            'header_title' => $organization->name,
            'header_subtitle' => 'Voucher',
            'show_logo' => true,
            'logo_url' => $page->logo_url,
            'show_contact' => true,
            'contact_phone' => $page->phone,
            'contact_email' => $page->email,
            'contact_address' => $page->address,
            'footer_note' => null,
            'show_payment_status' => true,
            'show_signature_boxes' => true,
        ];

        $raw = is_array($organization->voucher_print_template) ? $organization->voucher_print_template : [];
        $template = array_merge($templateDefaults, $raw);

        $paperParam = strtoupper(trim((string) $request->query('paper', '')));
        if (in_array($paperParam, ['A4', 'RECEIPT_80'], true)) {
            $template['paper_size'] = $paperParam;
        } elseif (in_array($paperParam, ['80', '80MM', 'RECEIPT', 'RECEIPT80'], true)) {
            $template['paper_size'] = 'RECEIPT_80';
        }

        if (empty($template['logo_url'])) {
            $template['logo_url'] = null;
        }
        if (empty($template['footer_note'])) {
            $template['footer_note'] = null;
        }

        return Inertia::render('Admin/Operations/VoucherPrint', [
            'voucher' => $model,
            'template' => $template,
            'voucher_policy' => trim((string) env('VOUCHER_POLICY', '')),
            'tracking_url' => route('public.voucher.track', [
                'org' => $organization->code,
                'voucherNo' => $model->voucher_no,
                'locale' => 'my',
            ]),
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
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        if ($voucherModel->isDraft()) {
            $snapshot = [
                'voucher_no' => $voucherModel->voucher_no,
            ];
            $voucherModel->delete();

            AuditLogger::record($actor, 'voucher.delete', null, $snapshot);

            return Redirect::route('admin.vouchers.index')->with('success', 'Voucher deleted successfully.');
        }

        if ($voucherModel->status !== 'CONFIRMED') {
            abort(403);
        }

        if (VoucherPayment::query()
            ->where('organization_id', $organizationId)
            ->where('voucher_id', $voucherModel->id)
            ->exists()) {
            return Redirect::back()->with('error', 'Cannot delete this confirmed voucher because it has payment records.');
        }

        $voucherModel->load('items:id,organization_id,voucher_id,from_warehouse_id,product_id,qty,unit');
        $voucherItemIds = $voucherModel->items->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($voucherItemIds === []) {
            return Redirect::back()->with('error', 'Cannot delete this confirmed voucher because it has no lines.');
        }

        if (TripItem::query()
            ->where('organization_id', $organizationId)
            ->whereIn('voucher_item_id', $voucherItemIds)
            ->exists()) {
            return Redirect::back()->with('error', 'Cannot delete this confirmed voucher because it has trip loads.');
        }

        $snapshot = ['voucher_no' => $voucherModel->voucher_no];
        try {
            DB::transaction(function () use ($organizationId, $voucherModel) {
                $lockedVoucher = Voucher::query()
                    ->whereKey($voucherModel->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($lockedVoucher->status !== 'CONFIRMED') {
                    throw ValidationException::withMessages([
                        'voucher' => ['Voucher status changed; cannot delete.'],
                    ]);
                }

                if (VoucherPayment::query()
                    ->where('organization_id', $organizationId)
                    ->where('voucher_id', $lockedVoucher->id)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'voucher' => ['Voucher has payment records and cannot be deleted.'],
                    ]);
                }

                $items = VoucherItem::query()
                    ->where('organization_id', $organizationId)
                    ->where('voucher_id', $lockedVoucher->id)
                    ->lockForUpdate()
                    ->get();

                $voucherItemIds = $items->pluck('id')->map(fn ($id) => (int) $id)->all();
                if ($voucherItemIds === []) {
                    throw ValidationException::withMessages([
                        'voucher' => ['Voucher has no lines and cannot be deleted.'],
                    ]);
                }

                if (TripItem::query()
                    ->where('organization_id', $organizationId)
                    ->whereIn('voucher_item_id', $voucherItemIds)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'voucher' => ['Voucher has trip loads and cannot be deleted.'],
                    ]);
                }

                VoucherItem::query()
                    ->where('organization_id', $organizationId)
                    ->where('voucher_id', $lockedVoucher->id)
                    ->delete();

                $lockedVoucher->delete();
            });
        } catch (ValidationException $e) {
            $msg = null;
            foreach ($e->errors() as $arr) {
                if (is_array($arr) && isset($arr[0])) {
                    $msg = $arr[0];
                    break;
                }
            }
            return Redirect::back()->with('error', $msg ?? 'Cannot delete voucher.');
        }

        AuditLogger::record($actor, 'voucher.safe_delete', null, $snapshot);

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

    public function markPaid(Request $request, string $voucher): RedirectResponse
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
        abort_if($voucherModel->payment_status === 'WAIVED', 422, 'Cannot mark a waived voucher as paid.');
        abort_if($voucherModel->total_amount === null, 422, 'Cannot mark as paid when total amount is not set.');

        $recordedAmount = 0.0;
        DB::transaction(function () use ($organizationId, $voucherModel, $actor, &$recordedAmount) {
            $lockedVoucher = Voucher::query()
                ->whereKey($voucherModel->id)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_if($lockedVoucher->status === 'DRAFT', 404);
            abort_if($lockedVoucher->payment_status === 'WAIVED', 422, 'Cannot mark a waived voucher as paid.');
            abort_if($lockedVoucher->total_amount === null, 422, 'Cannot mark as paid when total amount is not set.');

            $total = round((float) $lockedVoucher->total_amount, 2);
            if ($total <= 0.005) {
                if ($lockedVoucher->payment_status !== 'PAID') {
                    $lockedVoucher->payment_status = 'PAID';
                    $lockedVoucher->save();
                }
                return;
            }

            $payments = VoucherPayment::query()
                ->where('voucher_id', $lockedVoucher->id)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->get(['id', 'amount']);

            $paid = round((float) $payments->sum('amount'), 2);
            $remaining = max(0.0, $total - $paid);
            abort_if($remaining < 0.01, 422, 'Voucher is already fully paid.');

            VoucherPayment::query()->create([
                'organization_id' => $organizationId,
                'voucher_id' => $lockedVoucher->id,
                'amount' => round((float) $remaining, 2),
                'currency' => 'MMK',
                'payment_method' => 'CASH',
                'paid_at' => now(),
                'reference_no' => null,
                'note' => null,
                'received_by' => $actor->id,
            ]);

            $recordedAmount = round((float) $remaining, 2);
            $this->recomputeVoucherPaymentStatus($lockedVoucher->fresh());
        });

        AuditLogger::record($actor, 'voucher.payment.mark_paid', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'amount' => round((float) $recordedAmount, 2),
            'payment_method' => 'CASH',
        ]);

        return Redirect::back()->with('success', 'Voucher marked as paid.');
    }

    public function updateItem(Request $request, string $voucher, string $voucherItem): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('vouchers.manage'), 403);

        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherModel = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);

        try {
            DB::transaction(function () use ($organizationId, $voucherModel, $voucherItem, $request, $actor) {
                $lockedVoucher = Voucher::query()
                    ->whereKey($voucherModel->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                abort_if($lockedVoucher->status === 'DRAFT', 404);

                $item = VoucherItem::query()
                    ->whereKey($voucherItem)
                    ->where('organization_id', $organizationId)
                    ->where('voucher_id', $lockedVoucher->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $hasTripLoads = TripItem::query()
                    ->where('organization_id', $organizationId)
                    ->where('voucher_item_id', $item->id)
                    ->exists();

                $lockedByOperations = $hasTripLoads;

                if ($lockedByOperations) {
                    $validated = $request->validate([
                        'freight_amount' => ['nullable', 'integer', 'min:0'],
                    ]);

                    $item->fill([
                        'freight_rate' => null,
                        'freight_amount' => $validated['freight_amount'] ?? null,
                    ]);
                    $item->save();
                } else {
                    $validated = $request->validate([
                        'from_warehouse_id' => [
                            'required',
                            Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
                        ],
                        'qty' => ['required', 'numeric', 'min:0.001'],
                        'unit' => ['required', 'string', 'max:32'],
                        'description' => ['nullable', 'string', 'max:500'],
                        'freight_amount' => ['nullable', 'integer', 'min:0'],
                        'is_fragile' => ['sometimes', 'boolean'],
                    ]);

                    $item->fill([
                        'from_warehouse_id' => (int) $validated['from_warehouse_id'],
                        'qty' => $validated['qty'],
                        'unit' => $validated['unit'],
                        'description' => $validated['description'] ?? null,
                        'freight_rate' => null,
                        'freight_amount' => $validated['freight_amount'] ?? null,
                        'is_fragile' => (bool) ($validated['is_fragile'] ?? false),
                    ]);
                    $item->save();
                }

                $this->recalculateTotals($lockedVoucher);
                $this->recomputeVoucherPaymentStatus($lockedVoucher->fresh());
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors());
        }

        AuditLogger::record($actor, 'voucher.line.update', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'voucher_item_id' => (int) $voucherItem,
        ]);

        return Redirect::back()->with('success', 'Line updated.');
    }

    public function updateDetails(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('vouchers.manage'), 403);

        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'default_recipient_name' => ['required', 'string', 'max:255'],
            'default_recipient_phone' => ['required', 'string', 'max:64'],
            'default_destination_remark' => ['nullable', 'string', 'max:2000'],
            'total_weight' => ['nullable', 'numeric', 'min:0'],
        ]);

        $voucherModel = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);

        $before = $voucherModel->only([
            'default_recipient_name',
            'default_recipient_phone',
            'default_destination_remark',
            'total_weight',
        ]);

        DB::transaction(function () use ($organizationId, $voucherModel, $validated) {
            $lockedVoucher = Voucher::query()
                ->whereKey($voucherModel->id)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_if($lockedVoucher->status === 'DRAFT', 404);

            $remark = trim((string) ($validated['default_destination_remark'] ?? ''));
            $totalWeightRaw = $validated['total_weight'] ?? null;
            $totalWeight = $totalWeightRaw === null || $totalWeightRaw === '' ? 0.0 : (float) $totalWeightRaw;
            $lockedVoucher->fill([
                'default_recipient_name' => trim((string) $validated['default_recipient_name']),
                'default_recipient_phone' => trim((string) $validated['default_recipient_phone']),
                'default_destination_remark' => $remark !== '' ? $remark : null,
                'total_weight' => round($totalWeight, 2),
            ]);
            $lockedVoucher->save();
        });

        $freshVoucher = $voucherModel->fresh();

        AuditLogger::record($actor, 'voucher.details.update', $freshVoucher, [
            'voucher_no' => $voucherModel->voucher_no,
            'before' => $before,
            'after' => $freshVoucher->only([
                'default_recipient_name',
                'default_recipient_phone',
                'default_destination_remark',
                'total_weight',
            ]),
        ]);

        return Redirect::back()->with('success', 'Voucher details updated.');
    }

    public function updateAdditionalCosts(Request $request, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('vouchers.manage'), 403);

        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $this->validateVoucherAdditionalCostsPayload($request, $organizationId);

        $voucherModel = Voucher::query()
            ->whereKey($voucher)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        abort_if($voucherModel->status === 'DRAFT', 404);

        $before = $voucherModel->additional_costs;

        DB::transaction(function () use ($organizationId, $voucherModel, $validated) {
            $lockedVoucher = Voucher::query()
                ->whereKey($voucherModel->id)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_if($lockedVoucher->status === 'DRAFT', 404);

            $lockedVoucher->additional_costs = $this->normalizeVoucherAdditionalCosts($validated, $organizationId);
            $lockedVoucher->save();
        });

        AuditLogger::record($actor, 'voucher.additional_costs.update', $voucherModel->fresh(), [
            'voucher_no' => $voucherModel->voucher_no,
            'before' => $before,
            'after' => $voucherModel->fresh()->additional_costs,
        ]);

        return Redirect::back()->with('success', 'Additional costs updated.');
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

        $voucher->total_qty = $totalQty;
        if ($voucher->total_weight === null) {
            $voucher->total_weight = round((float) $totalWeight, 2);
        }

        $computedTotal = round((float) $freightSum, 2);
        $voucher->total_amount = $computedTotal > 0.0001 ? $computedTotal : null;
        $voucher->save();
    }

    private function validateVoucherAdditionalCostsPayload(Request $request, int $organizationId): array
    {
        return $request->validate([
            'additional_costs' => ['nullable', 'array', 'max:50'],
            'additional_costs.*.category_id' => [
                'required_with:additional_costs.*.amount',
                'integer',
                Rule::exists('voucher_additional_cost_categories', 'id')->where(fn ($q) => $q
                    ->where('organization_id', $organizationId)
                    ->whereNull('deleted_at')
                    ->where('status', 'ACTIVE')),
            ],
            'additional_costs.*.amount' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    private function normalizeVoucherAdditionalCosts(array $validated, int $organizationId): ?array
    {
        $raw = $validated['additional_costs'] ?? null;
        if (! is_array($raw)) {
            return null;
        }

        $ids = collect($raw)
            ->pluck('category_id')
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $categoryNameById = VoucherAdditionalCostCategory::query()
            ->where('organization_id', $organizationId)
            ->whereIn('id', $ids)
            ->pluck('name', 'id');

        $normalized = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }

            $categoryId = isset($row['category_id']) && $row['category_id'] !== ''
                ? (int) $row['category_id']
                : null;
            if ($categoryId === null) {
                continue;
            }
            $amount = $row['amount'] ?? null;
            $amount = $amount === null || $amount === '' ? 0.0 : (float) $amount;

            $categoryName = $categoryNameById->get($categoryId);
            if ($categoryName === null) {
                continue;
            }

            $normalized[] = [
                'category_id' => $categoryId,
                'category_name' => $categoryName,
                'amount' => round($amount, 2),
            ];
        }

        return $normalized === [] ? null : $normalized;
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
