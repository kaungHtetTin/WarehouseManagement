<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryConfirmation;
use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\Merchant;
use App\Models\Organization;
use App\Models\OrganizationPublicPage;
use App\Models\Trip;
use App\Models\TripItem;
use App\Models\TripStop;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\VoucherPayment;
use App\Models\Warehouse;
use App\Models\WarehouseFulfillmentInstruction;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\OperationalWarehouseContext;
use App\Services\Vouchers\VoucherOperationalStatusSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\View\View;

class TripManagementController extends Controller
{
    /** Voucher header statuses that still allow allocating remaining qty onto trips. */
    private const VOUCHER_STATUSES_ALLOWING_TRIP_LOAD = [
        'CONFIRMED',
        'LOADING',
        'IN_TRANSIT',
        'PARTIALLY_DELIVERED',
    ];

    public function __construct(
        private VoucherOperationalStatusSync $voucherOperationalStatusSync,
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $actor = $request->user();

        $filterWarehouses = $this->operationalContext->organizationWarehouses($actor);

        $allowedDestinationIds = $filterWarehouses->pluck('id')->map(fn ($id) => (int) $id)->all();

        $rawFilter = $request->query('destination_warehouse_id', $request->query('source_warehouse_id', 'all'));
        $selectedFilter = 'all';
        if ($rawFilter !== null && $rawFilter !== '' && (string) $rawFilter !== 'all') {
            $candidate = (int) $rawFilter;
            if (in_array($candidate, $allowedDestinationIds, true)) {
                $selectedFilter = (string) $candidate;
            }
        }
        $rawStatusFilter = (string) $request->query('status', 'all');
        $normalizedStatusFilter = $rawStatusFilter === 'all' ? 'all' : strtoupper($rawStatusFilter);
        $statusFilter = in_array($normalizedStatusFilter, ['all', 'PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP', 'COMPLETED', 'CANCELLED'], true)
            ? $normalizedStatusFilter
            : 'all';
        $perPage = (int) $request->query('per_page', 25);
        if (! in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }

        $trips = Trip::query()
            ->where('organization_id', $organizationId);

        if ($allowedDestinationIds === []) {
            $trips->whereRaw('1 = 0');
        } else {
            $trips->whereIn('source_warehouse_id', $allowedDestinationIds);
        }

        if ($selectedFilter !== 'all') {
            $trips->where('source_warehouse_id', (int) $selectedFilter);
        }

        $summaryQuery = clone $trips;
        $summary = [
            'total' => (clone $summaryQuery)->count(),
            'active' => (clone $summaryQuery)->whereIn('status', ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'])->count(),
            'loading' => (clone $summaryQuery)->where('status', 'LOADING')->count(),
            'completed' => (clone $summaryQuery)->where('status', 'COMPLETED')->count(),
            'cancelled' => (clone $summaryQuery)->where('status', 'CANCELLED')->count(),
        ];

        if ($statusFilter !== 'all') {
            $trips->where('status', $statusFilter);
        }

        $trips = $trips
            ->with([
                'vehicle:id,vehicle_no',
                'sourceWarehouse:id,city,address',
            ])
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/Operations/TripsIndex', [
            'trips' => $trips,
            'trip_destination_filter' => $selectedFilter,
            'trip_status_filter' => $statusFilter,
            'trip_filter_warehouses' => $filterWarehouses->values(),
            'trip_summary' => $summary,
        ]);
    }

    public function create(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $user = $request->user();

        $warehouses = $this->operationalContext->organizationWarehouses($user)->values();

        return Inertia::render('Admin/Operations/TripCreate', [
            'operatingWarehouses' => $warehouses,
            'routingWarehouses' => $warehouses,
            'defaultDestinationWarehouseId' => $this->operationalContext->resolveCurrentWarehouseId($user, $request),
        ]);
    }

    public function vehicleSearch(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 1) {
            return response()->json(['results' => []]);
        }

        $like = '%'.addcslashes(mb_strtoupper($q), '%_\\').'%';

        $results = Vehicle::query()
            ->where('organization_id', $organizationId)
            ->whereNull('deleted_at')
            ->whereRaw('UPPER(vehicle_no) LIKE ?', [$like])
            ->orderBy('vehicle_no')
            ->limit(25)
            ->get([
                'id',
                'vehicle_no',
                'vehicle_type',
                'warehouse_id',
                'capacity_weight',
                'capacity_volume',
                'status',
            ]);

        $latestTripByVehicleId = Trip::query()
            ->where('organization_id', $organizationId)
            ->whereIn('vehicle_id', $results->pluck('id')->all())
            ->whereNotNull('vehicle_id')
            ->orderByDesc('id')
            ->get(['vehicle_id', 'driver_name', 'driver_phone'])
            ->unique('vehicle_id')
            ->keyBy('vehicle_id');

        $results = $results->map(function (Vehicle $vehicle) use ($latestTripByVehicleId) {
            $latestTrip = $latestTripByVehicleId->get($vehicle->id);

            return array_merge($vehicle->toArray(), [
                'driver_name' => $latestTrip?->driver_name,
                'driver_phone' => $latestTrip?->driver_phone,
            ]);
        })->values();

        return response()->json(['results' => $results]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'vehicle_id' => [
                'nullable',
                'integer',
                Rule::exists('vehicles', 'id')->where(
                    fn ($q) => $q->where('organization_id', $organizationId)->whereNull('deleted_at')
                ),
            ],
            'vehicle' => ['required', 'array'],
            'vehicle.vehicle_no' => ['required', 'string', 'max:64'],
            'vehicle.capacity_weight' => ['nullable', 'numeric', 'min:0'],
            'destination_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'driver_name' => ['nullable', 'string', 'max:255'],
            'driver_phone' => ['nullable', 'string', 'max:64'],
            'remark' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->validateTripDestinationWarehouse($actor, (int) $validated['destination_warehouse_id']);

        try {
            $trip = DB::transaction(function () use ($actor, $organizationId, $validated) {
                $vehicle = $this->resolveVehicleForTrip(
                    $actor,
                    $organizationId,
                    $validated['vehicle'],
                    $validated['vehicle_id'] ?? null
                );

                $destinationWarehouseId = (int) $validated['destination_warehouse_id'];
                $trip = Trip::query()->create([
                    'organization_id' => $organizationId,
                    'trip_no' => $this->nextTripNo($organizationId),
                    'vehicle_id' => $vehicle->id,
                    'driver_name' => $validated['driver_name'] ?? null,
                    'driver_phone' => $validated['driver_phone'] ?? null,
                    'remark' => isset($validated['remark']) && trim((string) $validated['remark']) !== ''
                        ? trim((string) $validated['remark'])
                        : null,
                    'source_warehouse_id' => $destinationWarehouseId,
                    'status' => 'PLANNED',
                    'created_by' => $actor->id,
                ]);

                TripStop::query()->create([
                    'organization_id' => $organizationId,
                    'trip_id' => $trip->id,
                    'stop_order' => 1,
                    'warehouse_id' => $destinationWarehouseId,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                    'status' => 'PENDING',
                ]);

                return $trip;
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        AuditLogger::record($actor, 'trip.create', $trip, [
            'trip_no' => $trip->trip_no,
            'stops' => 1,
        ]);

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Trip created.');
    }

    public function show(Request $request, string $trip): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $model = Trip::query()
            ->whereKey($trip)
            ->where('organization_id', $organizationId)
            ->with([
                'vehicle:id,vehicle_no,vehicle_type,capacity_weight',
                'sourceWarehouse:id,city,address',
                'creator:id,name',
                'stops' => fn ($q) => $q->orderBy('stop_order')->with('warehouse:id,city,address'),
                'items' => fn ($q) => $q->with([
                    'tripStop:id,stop_order',
                    'deliveryConfirmations' => fn ($q2) => $q2
                        ->with('receivedByUser:id,name')
                        ->orderByDesc('id')
                        ->limit(25),
                    'voucherItem' => fn ($q2) => $q2->with([
                    'product:id,name,unit,default_weight',
                    'voucher:id,voucher_no,total_amount,payment_status,total_weight,additional_costs,merchant_id,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone',
                    'voucher.merchant:id,name',
                        'voucher.defaultToWarehouse:id,city,address',
                    ]),
                ]),
            ])
            ->firstOrFail();

        $model->setRelation(
            'items',
            $this->withPendingReceiptQtyForTripItems($model->items, (int) $organizationId)
        );

        $voucherIds = collect($model->items ?? [])
            ->map(fn ($i) => $i instanceof TripItem ? (int) ($i->voucherItem?->voucher?->id ?? 0) : 0)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($voucherIds !== []) {
            $paidByVoucherId = VoucherPayment::query()
                ->where('organization_id', $organizationId)
                ->whereIn('voucher_id', $voucherIds)
                ->selectRaw('voucher_id, COALESCE(SUM(amount), 0) as paid_amount')
                ->groupBy('voucher_id')
                ->get()
                ->keyBy(fn ($r) => (int) $r->voucher_id)
                ->map(fn ($r) => round((float) $r->paid_amount, 2));

            foreach ($model->items as $item) {
                $voucher = $item->voucherItem?->voucher;
                if ($voucher === null) {
                    continue;
                }
                $voucherId = (int) $voucher->id;
                if ($voucherId <= 0) {
                    continue;
                }
                $voucher->setAttribute('paid_amount', (float) ($paidByVoucherId[$voucherId] ?? 0.0));
            }
        }

        $user = $request->user();
        $canManageCargo = $user && $user->hasPermission('trips.manage')
            && in_array($model->status, ['PLANNED', 'LOADING'], true);

        $canLoadCargo = $user && $user->hasPermission('trips.manage')
            && in_array($model->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true);

        $canRecordDelivery = $user && $user->hasPermission('trips.manage')
            && in_array($model->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true);

        $departureCaps = $this->tripDepartureCapabilities($user, $model, (int) $organizationId);

        $canManageTripCosts = $user && $user->hasPermission('trips.manage');

        $tripCostCategories = FinanceCategory::query()
            ->where('organization_id', $organizationId)
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('status', 'ACTIVE')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name']);

        $tripCostEntries = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('reference_type', 'TRIP')
            ->where('reference_id', $model->id)
            ->with([
                'category:id,name',
                'creator:id,name',
            ])
            ->orderByDesc('id')
            ->get([
                'id',
                'organization_id',
                'category_id',
                'amount',
                'note',
                'created_by',
                'occurred_at',
                'reference_type',
                'reference_id',
                'created_at',
                'updated_at',
            ]);

        $tripExtraCostTotal = round((float) $tripCostEntries->sum(fn ($r) => (float) $r->amount), 2);

        $voucherPaymentsTotal = 0.0;
        if (isset($paidByVoucherId) && $paidByVoucherId instanceof Collection) {
            $voucherPaymentsTotal = round((float) $paidByVoucherId->sum(fn ($n) => (float) $n), 2);
        }

        $voucherAdditionalCostsTotal = 0.0;
        $seenVoucher = [];
        foreach (($model->items ?? []) as $item) {
            if (! $item instanceof TripItem) {
                continue;
            }
            $voucher = $item->voucherItem?->voucher;
            if ($voucher === null) {
                continue;
            }
            $vid = (int) $voucher->id;
            if ($vid <= 0 || isset($seenVoucher[$vid])) {
                continue;
            }
            $seenVoucher[$vid] = true;

            $costs = $voucher->additional_costs;
            if (! is_array($costs)) {
                continue;
            }
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
                    $voucherAdditionalCostsTotal += $n;
                }
            }
        }
        $voucherAdditionalCostsTotal = round($voucherAdditionalCostsTotal, 2);

        $tripNetIncome = round($voucherPaymentsTotal - $voucherAdditionalCostsTotal - $tripExtraCostTotal, 2);

        $netIncomeEntry = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('reference_type', 'TRIP_NET_INCOME')
            ->where('reference_id', $model->id)
            ->where('direction', 'INCOME')
            ->first(['id', 'amount', 'occurred_at', 'category_id']);

        $pendingDeliveryLines = collect($model->items ?? [])
            ->filter(fn ($i) => $i instanceof TripItem)
            ->filter(function (TripItem $i) {
                $loaded = (float) ($i->loaded_qty ?? 0);
                $delivered = (float) ($i->delivered_qty ?? 0);
                if ($loaded <= 0.0001) {
                    return false;
                }
                return $delivered + 0.0001 < $loaded;
            })
            ->count();

        $unpaidVouchers = collect($model->items ?? [])
            ->map(fn ($i) => $i instanceof TripItem ? $i->voucherItem?->voucher : null)
            ->filter(fn ($v) => $v !== null && (int) ($v->id ?? 0) > 0)
            ->unique(fn ($v) => (int) $v->id)
            ->filter(fn ($v) => (string) ($v->payment_status ?? '') !== 'PAID')
            ->count();

        $tripNetIncomeEligible = $voucherIds !== [] && $pendingDeliveryLines === 0 && $unpaidVouchers === 0;

        return Inertia::render('Admin/Operations/TripDetail', [
            'trip' => $model,
            'can_manage_cargo' => $canManageCargo,
            'can_load_cargo' => $canLoadCargo,
            'can_record_delivery' => $canRecordDelivery,
            'can_record_voucher_payments' => (bool) ($user && $user->hasPermission('payments.manage')),
            'can_manage_trip_costs' => $canManageTripCosts,
            'can_record_trip_net_income' => (bool) ($user && $user->hasPermission('finance.manage')),
            'can_delete_trip' => (bool) ($user && $user->hasPermission('trips.manage') && in_array($model->status, ['PLANNED', 'CANCELLED'], true)),
            'can_mark_departed' => $departureCaps['can_mark_departed'],
            'can_undo_depart' => $departureCaps['can_undo_depart'],
            'warehouses' => $canManageCargo
                ? $this->operationalContext->routingWarehouses($user)->values()
                : [],
            'loadable_vouchers' => $canLoadCargo
                ? $this->loadableVouchers($model, $organizationId)
                : [],
            'trip_total_weight' => $this->tripTotalWeight($model),
            'trip_labor_cost' => $this->tripLaborCost($model),
            'trip_cost_categories' => $tripCostCategories,
            'trip_cost_entries' => $tripCostEntries,
            'trip_extra_cost_total' => $tripExtraCostTotal,
            'trip_net_income' => $tripNetIncome,
            'trip_net_income_eligibility' => [
                'eligible' => $tripNetIncomeEligible,
                'pending_delivery_lines' => $pendingDeliveryLines,
                'unpaid_vouchers' => $unpaidVouchers,
            ],
            'trip_net_income_recorded' => $netIncomeEntry !== null,
            'trip_net_income_entry' => $netIncomeEntry,
        ]);
    }

    public function destroy(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('trips.manage'), 403);

        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        try {
            DB::transaction(function () use ($organizationId, $trip, $actor) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'CANCELLED'], true)) {
                    throw ValidationException::withMessages([
                        'trip' => ['Trip can only be deleted when status is PLANNED or CANCELLED.'],
                    ]);
                }

                $items = TripItem::query()
                    ->where('organization_id', $organizationId)
                    ->where('trip_id', $tripLocked->id)
                    ->lockForUpdate()
                    ->get(['id', 'voucher_item_id', 'delivered_qty']);

                $tripItemIds = $items->pluck('id')->map(fn ($id) => (int) $id)->all();
                $voucherItemIds = $items->pluck('voucher_item_id')->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
                $voucherIds = $voucherItemIds === []
                    ? []
                    : VoucherItem::query()
                        ->where('organization_id', $organizationId)
                        ->whereIn('id', $voucherItemIds)
                        ->pluck('voucher_id')
                        ->map(fn ($id) => (int) $id)
                        ->filter(fn ($id) => $id > 0)
                        ->unique()
                        ->values()
                        ->all();

                if ($items->contains(fn ($i) => (float) $i->delivered_qty > 0.0001)) {
                    throw ValidationException::withMessages([
                        'trip' => ['Trip has delivered quantity and cannot be deleted.'],
                    ]);
                }

                if ($tripItemIds !== [] && DeliveryConfirmation::query()
                    ->where('organization_id', $organizationId)
                    ->whereIn('trip_item_id', $tripItemIds)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'trip' => ['Trip has delivery confirmations and cannot be deleted.'],
                    ]);
                }

                if ($tripItemIds !== [] && WarehouseFulfillmentInstruction::query()
                    ->where('organization_id', $organizationId)
                    ->whereIn('trip_item_id', $tripItemIds)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'trip' => ['Trip has fulfillment processing records and cannot be deleted.'],
                    ]);
                }

                FinanceEntry::query()
                    ->where('organization_id', $organizationId)
                    ->where(function ($q) use ($tripLocked) {
                        $q->where(function ($q2) use ($tripLocked) {
                            $q2->where('scope', 'TRIP_COST')
                                ->where('reference_type', 'TRIP')
                                ->where('reference_id', $tripLocked->id);
                        })->orWhere(function ($q2) use ($tripLocked) {
                            $q2->where('reference_type', 'TRIP_NET_INCOME')
                                ->where('reference_id', $tripLocked->id);
                        });
                    })
                    ->delete();

                $tripNo = $tripLocked->trip_no;
                $tripLocked->delete();

                if ($voucherItemIds !== []) {
                    $voucherItems = VoucherItem::query()
                        ->where('organization_id', $organizationId)
                        ->whereIn('id', $voucherItemIds)
                        ->lockForUpdate()
                        ->get();

                    foreach ($voucherItems as $vi) {
                        $this->refreshVoucherItemLoadedQty($vi);
                        $this->refreshVoucherItemDeliveredQty($vi);
                    }
                }

                if ($voucherIds !== []) {
                    $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, $voucherIds, $actor);
                }

                AuditLogger::record($actor, 'trip.delete', $tripLocked, [
                    'trip_no' => $tripNo,
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors());
        }

        return Redirect::route('admin.trips.index')->with('success', 'Trip deleted.');
    }

    public function storeNetIncomeLedgerEntry(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->where('organization_id', $organizationId)
            ->whereKey($trip)
            ->firstOrFail();

        $alreadyRecorded = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('reference_type', 'TRIP_NET_INCOME')
            ->where('reference_id', $tripModel->id)
            ->where('direction', 'INCOME')
            ->exists();
        if ($alreadyRecorded) {
            return Redirect::route('admin.trips.show', $tripModel)
                ->with('info', 'Net income already recorded in Finance Ledger.');
        }

        $voucherIds = TripItem::query()
            ->where('trip_items.organization_id', $organizationId)
            ->where('trip_id', $tripModel->id)
            ->join('voucher_items', 'voucher_items.id', '=', 'trip_items.voucher_item_id')
            ->selectRaw('DISTINCT voucher_items.voucher_id as voucher_id')
            ->pluck('voucher_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        $pendingDeliveryLines = (int) TripItem::query()
            ->where('organization_id', $organizationId)
            ->where('trip_id', $tripModel->id)
            ->where('loaded_qty', '>', 0)
            ->whereRaw('delivered_qty + 0.0001 < loaded_qty')
            ->count();
        if ($pendingDeliveryLines > 0) {
            return Redirect::route('admin.trips.show', $tripModel)
                ->with('error', 'Deliver all cargo lines on this trip before adding net income to the ledger.');
        }

        if ($voucherIds === []) {
            return Redirect::route('admin.trips.show', $tripModel)
                ->with('error', 'Trip has no vouchers, so net income cannot be recorded.');
        }

        $unpaidVouchers = (int) Voucher::query()
            ->where('organization_id', $organizationId)
            ->whereIn('id', $voucherIds)
            ->where('payment_status', '!=', 'PAID')
            ->count();
        if ($unpaidVouchers > 0) {
            return Redirect::route('admin.trips.show', $tripModel)
                ->with('error', 'All vouchers on this trip must be paid before adding net income to the ledger.');
        }

        $voucherPaymentsTotal = 0.0;
        if ($voucherIds !== []) {
            $voucherPaymentsTotal = round((float) VoucherPayment::query()
                ->where('organization_id', $organizationId)
                ->whereIn('voucher_id', $voucherIds)
                ->sum('amount'), 2);
        }

        $voucherAdditionalCostsTotal = 0.0;
        if ($voucherIds !== []) {
            $vouchers = Voucher::query()
                ->where('organization_id', $organizationId)
                ->whereIn('id', $voucherIds)
                ->get(['id', 'additional_costs']);

            foreach ($vouchers as $voucher) {
                $costs = $voucher->additional_costs;
                if (! is_array($costs)) {
                    continue;
                }
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
                        $voucherAdditionalCostsTotal += $n;
                    }
                }
            }
        }
        $voucherAdditionalCostsTotal = round($voucherAdditionalCostsTotal, 2);

        $tripCostsTotal = round((float) FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('reference_type', 'TRIP')
            ->where('reference_id', $tripModel->id)
            ->sum('amount'), 2);

        $netIncome = round($voucherPaymentsTotal - $voucherAdditionalCostsTotal - $tripCostsTotal, 2);
        $netIncomeInt = (int) round($netIncome);
        if ($netIncomeInt <= 0) {
            return Redirect::route('admin.trips.show', $tripModel)
                ->with('error', 'Net income is not positive, so it cannot be recorded.');
        }

        $category = FinanceCategory::query()->updateOrCreate(
            [
                'organization_id' => $organizationId,
                'scope' => 'GENERAL',
                'name' => 'Trip',
            ],
            [
                'direction' => 'BOTH',
                'status' => 'ACTIVE',
                'sort_order' => 0,
            ]
        );

        $occurredAt = $tripModel->departed_at ?? now();

        $entry = FinanceEntry::query()->create([
            'organization_id' => $organizationId,
            'warehouse_id' => null,
            'scope' => $category->scope,
            'direction' => 'INCOME',
            'category_id' => $category->id,
            'amount' => $netIncomeInt,
            'currency' => 'MMK',
            'note' => (string) $tripModel->trip_no,
            'occurred_at' => $occurredAt,
            'reference_type' => 'TRIP_NET_INCOME',
            'reference_id' => $tripModel->id,
            'source' => 'SYSTEM',
            'created_by' => $actor->id,
        ]);

        AuditLogger::record($actor, 'trip_net_income_ledger.create', $entry, [
            'trip_id' => $tripModel->id,
            'amount' => (float) $entry->amount,
        ]);

        return Redirect::route('admin.trips.show', $tripModel)
            ->with('success', 'Net income added to Finance Ledger.');
    }

    public function storeCostEntry(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->where('organization_id', $organizationId)
            ->whereKey($trip)
            ->firstOrFail();

        $validated = $request->validate([
            'category_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:1000000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $category = FinanceCategory::query()
            ->where('organization_id', $organizationId)
            ->whereKey((int) $validated['category_id'])
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('status', 'ACTIVE')
            ->firstOrFail();

        $entry = FinanceEntry::query()->create([
            'organization_id' => $organizationId,
            'warehouse_id' => $tripModel->source_warehouse_id,
            'scope' => 'TRIP_COST',
            'direction' => 'EXPENSE',
            'category_id' => $category->id,
            'amount' => round((float) $validated['amount'], 2),
            'currency' => 'MMK',
            'note' => isset($validated['note']) ? trim((string) $validated['note']) : null,
            'occurred_at' => now(),
            'reference_type' => 'TRIP',
            'reference_id' => $tripModel->id,
            'source' => 'MANUAL',
            'created_by' => $actor->id,
        ]);

        AuditLogger::record($actor, 'trip_cost_entry.create', $entry, [
            'trip_id' => $tripModel->id,
            'category_name' => $category->name,
            'amount' => $entry->amount,
        ]);

        return Redirect::route('admin.trips.show', $tripModel)
            ->with('success', 'Trip cost added.');
    }

    public function updateCostEntry(Request $request, string $trip, string $costEntry): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->where('organization_id', $organizationId)
            ->whereKey($trip)
            ->firstOrFail();

        $entry = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('reference_type', 'TRIP')
            ->where('reference_id', $tripModel->id)
            ->whereKey($costEntry)
            ->firstOrFail();

        $validated = $request->validate([
            'category_id' => ['sometimes', 'required', 'integer'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0.01', 'max:1000000000'],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $snapshot = [
            'id' => $entry->id,
            'trip_id' => $tripModel->id,
            'category_id' => $entry->category_id,
            'amount' => (float) $entry->amount,
            'note' => $entry->note,
        ];

        if (array_key_exists('category_id', $validated)) {
            $category = FinanceCategory::query()
                ->where('organization_id', $organizationId)
                ->whereKey((int) $validated['category_id'])
                ->where('scope', 'TRIP_COST')
                ->where('direction', 'EXPENSE')
                ->firstOrFail();
            $entry->category_id = $category->id;
        }

        if (array_key_exists('amount', $validated)) {
            $entry->amount = round((float) $validated['amount'], 2);
        }

        if (array_key_exists('note', $validated)) {
            $entry->note = $validated['note'] !== null ? trim((string) $validated['note']) : null;
        }

        $entry->save();

        AuditLogger::record($actor, 'trip_cost_entry.update', $entry, [
            'before' => $snapshot,
            'after' => [
                'category_id' => $entry->category_id,
                'amount' => (float) $entry->amount,
                'note' => $entry->note,
            ],
        ]);

        return Redirect::route('admin.trips.show', $tripModel)
            ->with('success', 'Trip cost updated.');
    }

    public function destroyCostEntry(Request $request, string $trip, string $costEntry): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->where('organization_id', $organizationId)
            ->whereKey($trip)
            ->firstOrFail();

        $entry = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('scope', 'TRIP_COST')
            ->where('direction', 'EXPENSE')
            ->where('reference_type', 'TRIP')
            ->where('reference_id', $tripModel->id)
            ->whereKey($costEntry)
            ->with('category:id,name')
            ->firstOrFail();

        $snapshot = [
            'id' => $entry->id,
            'trip_id' => $tripModel->id,
            'category_name' => $entry->category?->name,
            'amount' => (float) $entry->amount,
            'note' => $entry->note,
        ];

        $entry->delete();

        AuditLogger::record($actor, 'trip_cost_entry.delete', null, $snapshot);

        return Redirect::route('admin.trips.show', $tripModel)
            ->with('success', 'Trip cost deleted.');
    }

    private function tripTotalWeight(Trip $trip): ?float
    {
        $byVoucher = [];

        foreach (($trip->items ?? []) as $item) {
            if (! $item instanceof TripItem) {
                continue;
            }
            $vi = $item->voucherItem;
            $voucher = $vi?->voucher;
            if ($voucher === null) {
                continue;
            }

            $vid = (int) $voucher->id;
            if (! isset($byVoucher[$vid])) {
                $byVoucher[$vid] = [
                    'voucher_weight' => $voucher->total_weight !== null ? (float) $voucher->total_weight : null,
                    'fallback_weight' => 0.0,
                ];
            }

            $pw = $vi?->product?->default_weight;
            if ($pw === null || $pw === '') {
                continue;
            }

            $loaded = (float) ($item->loaded_qty ?? 0);
            $byVoucher[$vid]['fallback_weight'] += $loaded * (float) $pw;
        }

        $sum = 0.0;
        foreach ($byVoucher as $row) {
            $vw = $row['voucher_weight'];
            if ($vw !== null && $vw > 0.0001) {
                $sum += (float) $vw;
            } else {
                $sum += (float) $row['fallback_weight'];
            }
        }

        $sum = round($sum, 3);

        return $sum > 0.0001 ? $sum : null;
    }

    private function tripLaborCost(Trip $trip): float
    {
        $sum = 0.0;
        $seen = [];
        foreach (($trip->items ?? []) as $item) {
            if (! $item instanceof TripItem) {
                continue;
            }
            $voucher = $item->voucherItem?->voucher;
            if ($voucher === null) {
                continue;
            }
            $vid = (int) $voucher->id;
            if (isset($seen[$vid])) {
                continue;
            }
            $seen[$vid] = true;

            $costs = $voucher->additional_costs;
            if (! is_array($costs)) {
                continue;
            }
            foreach ($costs as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $nameRaw = $row['category_name'] ?? $row['label'] ?? null;
                $name = $nameRaw !== null ? strtolower(trim((string) $nameRaw)) : '';
                if ($name !== 'labor' && $name !== 'labour') {
                    continue;
                }
                $a = $row['amount'] ?? null;
                if ($a === null || $a === '') {
                    continue;
                }
                $n = (float) $a;
                if ($n > 0) {
                    $sum += $n;
                }
            }
        }

        return round($sum, 2);
    }

    public function updateStatus(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'target_status' => ['required', Rule::in(['DEPARTED', 'PLANNED'])],
        ]);

        $target = $validated['target_status'];

        try {
            DB::transaction(function () use ($actor, $organizationId, $trip, $target) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! $this->userMayMutateTripSourceWarehouse($actor, $tripLocked)) {
                    throw ValidationException::withMessages([
                        'target_status' => ['You do not have access to manage this trip\'s source warehouse.'],
                    ]);
                }

                if ($target === 'DEPARTED') {
                    if (! in_array($tripLocked->status, ['PLANNED', 'LOADING'], true)) {
                        throw ValidationException::withMessages([
                            'target_status' => ['The trip can only depart while it is planned or loading.'],
                        ]);
                    }

                    $loadedSum = (float) TripItem::query()
                        ->where('trip_id', $tripLocked->id)
                        ->where('organization_id', $organizationId)
                        ->sum('loaded_qty');

                    if ($loadedSum < 0.0001) {
                        throw ValidationException::withMessages([
                            'target_status' => ['Load cargo onto the trip before marking it as departed.'],
                        ]);
                    }

                    $tripLocked->status = 'DEPARTED';
                    if ($tripLocked->departed_at === null) {
                        $tripLocked->departed_at = now();
                    }
                    $tripLocked->save();

                    AuditLogger::record($actor, 'trip.status_transition', $tripLocked, [
                        'trip_no' => $tripLocked->trip_no,
                        'status_to' => 'DEPARTED',
                    ]);

                    return;
                }

                if ($tripLocked->status !== 'DEPARTED') {
                    throw ValidationException::withMessages([
                        'target_status' => ['Only a departed trip can be set back to planned, and only before deliveries are recorded.'],
                    ]);
                }

                $deliveredSum = (float) TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->sum('delivered_qty');

                if ($deliveredSum > 0.0001) {
                    throw ValidationException::withMessages([
                        'target_status' => ['Cannot revert departure after cargo has been delivered.'],
                    ]);
                }

                $hasConfirmations = DeliveryConfirmation::query()
                    ->where('organization_id', $organizationId)
                    ->whereHas('tripItem', fn ($q) => $q->where('trip_id', $tripLocked->id))
                    ->exists();

                if ($hasConfirmations) {
                    throw ValidationException::withMessages([
                        'target_status' => ['Cannot revert departure after delivery receipts exist.'],
                    ]);
                }

                $tripLocked->status = 'PLANNED';
                $tripLocked->departed_at = null;
                $tripLocked->save();

                AuditLogger::record($actor, 'trip.status_transition', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'status_to' => 'PLANNED',
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors());
        }

        $message = $target === 'DEPARTED'
            ? 'Trip marked as departed.'
            : 'Trip set back to planned.';

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', $message);
    }

    public function storeItem(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'voucher_item_id' => ['required', 'integer'],
            'loaded_qty' => ['required', 'numeric', 'min:0.001'],
        ]);

        try {
            DB::transaction(function () use ($validated, $organizationId, $trip, $actor) {
            $tripLocked = Trip::query()
                ->whereKey($trip)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                throw ValidationException::withMessages([
                    'loaded_qty' => ['Cargo cannot be loaded onto this trip in its current status.'],
                ]);
            }

            $voucherItem = VoucherItem::query()
                ->whereKey($validated['voucher_item_id'])
                ->where('organization_id', $organizationId)
                ->with('voucher:id,status,default_to_warehouse_id,total_weight')
                ->lockForUpdate()
                ->first();

            if ($voucherItem === null || ! in_array($voucherItem->voucher->status, self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD, true)) {
                throw ValidationException::withMessages([
                    'voucher_item_id' => ['Select an active voucher line that still has remaining quantity for your organization.'],
                ]);
            }

            $destinationWarehouseId = TripStop::query()
                ->where('trip_id', $tripLocked->id)
                ->where('organization_id', $organizationId)
                ->orderBy('stop_order')
                ->value('warehouse_id');
            if ($destinationWarehouseId === null) {
                throw ValidationException::withMessages([
                    'voucher_item_id' => ['Trip destination warehouse is not set.'],
                ]);
            }

            if ((int) ($voucherItem->voucher?->default_to_warehouse_id ?? 0) !== (int) $destinationWarehouseId) {
                throw ValidationException::withMessages([
                    'voucher_item_id' => ['This voucher is for a different destination warehouse than this trip.'],
                ]);
            }

            $delta = round((float) $validated['loaded_qty'], 3);

            $allocated = (float) TripItem::query()
                ->where('voucher_item_id', $voucherItem->id)
                ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
                ->sum('loaded_qty');

            $qty = (float) $voucherItem->qty;
            if ($allocated + $delta > $qty + 0.0001) {
                $remaining = max(0, $qty - $allocated);
                throw ValidationException::withMessages([
                    'loaded_qty' => [
                        'Quantity exceeds remaining on this voucher line (remaining: '
                            .number_format($remaining, 3).' '.$voucherItem->unit.').',
                    ],
                ]);
            }

            $voucherId = (int) $voucherItem->voucher_id;
            $alreadyOnTrip = TripItem::query()
                ->where('trip_id', $tripLocked->id)
                ->where('organization_id', $organizationId)
                ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucherId))
                ->exists();

            if (! $alreadyOnTrip) {
                $capW = (float) (Vehicle::query()
                    ->whereKey($tripLocked->vehicle_id)
                    ->where('organization_id', $organizationId)
                    ->whereNull('deleted_at')
                    ->value('capacity_weight') ?? 0);
                if ($capW > 0.0001) {
                    $tripVoucherIds = TripItem::query()
                        ->where('trip_id', $tripLocked->id)
                        ->where('trip_items.organization_id', $organizationId)
                        ->join('voucher_items', 'voucher_items.id', '=', 'trip_items.voucher_item_id')
                        ->selectRaw('DISTINCT voucher_items.voucher_id as voucher_id')
                        ->pluck('voucher_id')
                        ->map(fn ($id) => (int) $id)
                        ->all();

                    $knownSum = $tripVoucherIds !== []
                        ? (float) Voucher::query()
                            ->where('organization_id', $organizationId)
                            ->whereIn('id', $tripVoucherIds)
                            ->whereNotNull('total_weight')
                            ->sum('total_weight')
                        : 0.0;
                    $knownSum = round($knownSum, 3);

                    $vw = $voucherItem->voucher?->total_weight !== null ? (float) $voucherItem->voucher->total_weight : null;
                    if ($vw !== null && $vw > 0.0001 && $knownSum + $vw > $capW + 0.0001) {
                        throw ValidationException::withMessages([
                            'voucher_item_id' => ['Vehicle capacity weight exceeded.'],
                        ]);
                    }
                }
            }

            $existing = TripItem::query()
                ->where('trip_id', $tripLocked->id)
                ->where('voucher_item_id', $voucherItem->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->loaded_qty = round((float) $existing->loaded_qty + $delta, 3);
                $existing->save();
                $tripItem = $existing;
            } else {
                $tripItem = TripItem::query()->create([
                    'organization_id' => $organizationId,
                    'trip_id' => $tripLocked->id,
                    'voucher_item_id' => $voucherItem->id,
                    'trip_stop_id' => null,
                    'loaded_qty' => $delta,
                    'delivered_qty' => 0,
                    'status' => 'LOADED',
                ]);
            }

            $this->refreshVoucherItemLoadedQty($voucherItem);

            AuditLogger::record($actor, 'trip_item.load', $tripItem, [
                'trip_no' => $tripLocked->trip_no,
                'voucher_item_id' => $voucherItem->id,
                'delta_loaded_qty' => $delta,
            ]);

            $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucherItem->voucher_id], $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Cargo loaded onto trip.');
    }

    public function storeVoucherLoad(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'voucher_id' => ['required', 'integer'],
        ]);

        $voucherId = (int) $validated['voucher_id'];

        try {
            $loadedLines = 0;
            $weightWarning = false;

            DB::transaction(function () use ($voucherId, $organizationId, $trip, $actor, &$loadedLines, &$weightWarning) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'voucher_id' => ['Cargo cannot be loaded onto this trip in its current status.'],
                    ]);
                }

                $voucher = Voucher::query()
                    ->whereKey($voucherId)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($voucher->status, self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD, true)) {
                    throw ValidationException::withMessages([
                        'voucher_id' => ['Select a confirmed voucher that still allows trip loading.'],
                    ]);
                }

                $destinationWarehouseId = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->orderBy('stop_order')
                    ->value('warehouse_id');
                if ($destinationWarehouseId === null) {
                    throw ValidationException::withMessages([
                        'voucher_id' => ['Trip destination warehouse is not set.'],
                    ]);
                }

                if ((int) ($voucher->default_to_warehouse_id ?? 0) !== (int) $destinationWarehouseId) {
                    throw ValidationException::withMessages([
                        'voucher_id' => ['This voucher is for a different destination warehouse than this trip.'],
                    ]);
                }

                $alreadyOnTrip = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucher->id))
                    ->exists();

                if (! $alreadyOnTrip) {
                    $capW = (float) (Vehicle::query()
                        ->whereKey($tripLocked->vehicle_id)
                        ->where('organization_id', $organizationId)
                        ->whereNull('deleted_at')
                        ->value('capacity_weight') ?? 0);
                    if ($capW > 0.0001) {
                        $tripVoucherIds = TripItem::query()
                            ->where('trip_id', $tripLocked->id)
                            ->where('trip_items.organization_id', $organizationId)
                            ->join('voucher_items', 'voucher_items.id', '=', 'trip_items.voucher_item_id')
                            ->selectRaw('DISTINCT voucher_items.voucher_id as voucher_id')
                            ->pluck('voucher_id')
                            ->map(fn ($id) => (int) $id)
                            ->all();

                        $knownSum = $tripVoucherIds !== []
                            ? (float) Voucher::query()
                                ->where('organization_id', $organizationId)
                                ->whereIn('id', $tripVoucherIds)
                                ->whereNotNull('total_weight')
                                ->sum('total_weight')
                            : 0.0;
                        $knownSum = round($knownSum, 3);

                        $vw = $voucher->total_weight !== null ? (float) $voucher->total_weight : null;
                        if ($vw !== null && $vw > 0.0001 && $knownSum + $vw > $capW + 0.0001) {
                            throw ValidationException::withMessages([
                                'voucher_id' => ['Vehicle capacity weight exceeded.'],
                            ]);
                        }
                    }

                    if ($voucher->total_weight === null) {
                        $weightWarning = true;
                    }
                }

                $loadedLines += $this->loadVoucherLinesOntoTrip($tripLocked, $voucher, $organizationId, $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with($weightWarning ? 'warning' : 'success', $weightWarning
                ? 'Loaded voucher onto trip. Warning: voucher total weight is missing, so capacity check may be incomplete.'
                : ($loadedLines === 1 ? 'Loaded 1 voucher line onto trip.' : "Loaded {$loadedLines} voucher lines onto trip."));
    }

    public function storeVoucherLoadBatch(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'voucher_ids' => ['required', 'array', 'min:1'],
            'voucher_ids.*' => ['required', 'integer'],
        ]);

        $voucherIds = collect($validated['voucher_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        try {
            $loadedLines = 0;
            $loadedVouchers = 0;
            $weightWarning = false;

            DB::transaction(function () use ($voucherIds, $organizationId, $trip, $actor, &$loadedLines, &$loadedVouchers, &$weightWarning) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'voucher_ids' => ['Cargo cannot be loaded onto this trip in its current status.'],
                    ]);
                }

                $destinationWarehouseId = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->orderBy('stop_order')
                    ->value('warehouse_id');
                if ($destinationWarehouseId === null) {
                    throw ValidationException::withMessages([
                        'voucher_ids' => ['Trip destination warehouse is not set.'],
                    ]);
                }

                $vouchers = Voucher::query()
                    ->where('organization_id', $organizationId)
                    ->whereIn('id', $voucherIds)
                    ->lockForUpdate()
                    ->get();

                if ($vouchers->count() !== count($voucherIds)) {
                    throw ValidationException::withMessages([
                        'voucher_ids' => ['Some selected vouchers were not found.'],
                    ]);
                }

                foreach ($vouchers as $voucher) {
                    if (! in_array($voucher->status, self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD, true)) {
                        throw ValidationException::withMessages([
                            'voucher_ids' => ['Select only confirmed vouchers that still allow trip loading.'],
                        ]);
                    }
                    if ((int) ($voucher->default_to_warehouse_id ?? 0) !== (int) $destinationWarehouseId) {
                        throw ValidationException::withMessages([
                            'voucher_ids' => ['One or more selected vouchers are for a different destination warehouse than this trip.'],
                        ]);
                    }
                    if ($voucher->total_weight === null) {
                        $weightWarning = true;
                    }
                }

                $capW = (float) (Vehicle::query()
                    ->whereKey($tripLocked->vehicle_id)
                    ->where('organization_id', $organizationId)
                    ->whereNull('deleted_at')
                    ->value('capacity_weight') ?? 0);
                if ($capW > 0.0001) {
                    $tripVoucherIds = TripItem::query()
                        ->where('trip_id', $tripLocked->id)
                        ->where('trip_items.organization_id', $organizationId)
                        ->join('voucher_items', 'voucher_items.id', '=', 'trip_items.voucher_item_id')
                        ->selectRaw('DISTINCT voucher_items.voucher_id as voucher_id')
                        ->pluck('voucher_id')
                        ->map(fn ($id) => (int) $id)
                        ->all();

                    $existingKnownSum = $tripVoucherIds !== []
                        ? (float) Voucher::query()
                            ->where('organization_id', $organizationId)
                            ->whereIn('id', $tripVoucherIds)
                            ->whereNotNull('total_weight')
                            ->sum('total_weight')
                        : 0.0;

                    $selectedKnownSum = (float) $vouchers
                        ->filter(fn ($v) => $v->total_weight !== null)
                        ->sum('total_weight');

                    $knownSum = round($existingKnownSum + $selectedKnownSum, 3);

                    if ($knownSum > $capW + 0.0001) {
                        throw ValidationException::withMessages([
                            'voucher_ids' => ['Vehicle capacity weight exceeded.'],
                        ]);
                    }
                }

                foreach ($vouchers as $voucher) {
                    $loadedLines += $this->loadVoucherLinesOntoTrip($tripLocked, $voucher, $organizationId, $actor);
                    $loadedVouchers++;
                }
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with($weightWarning ? 'warning' : 'success', $weightWarning
                ? "Loaded {$loadedVouchers} vouchers onto trip. Warning: one or more voucher total weights are missing, so capacity check may be incomplete."
                : "Loaded {$loadedVouchers} vouchers ({$loadedLines} lines) onto trip.");
    }

    private function loadVoucherLinesOntoTrip(Trip $tripLocked, Voucher $voucher, int $organizationId, User $actor): int
    {
        $items = VoucherItem::query()
            ->where('organization_id', $organizationId)
            ->where('voucher_id', $voucher->id)
            ->orderBy('line_no')
            ->lockForUpdate()
            ->get();

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'voucher_id' => ['This voucher has no lines to load.'],
            ]);
        }

        $allocMap = TripItem::query()
            ->where('organization_id', $organizationId)
            ->whereIn('voucher_item_id', $items->pluck('id'))
            ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
            ->selectRaw('voucher_item_id, SUM(loaded_qty) as allocated')
            ->groupBy('voucher_item_id')
            ->pluck('allocated', 'voucher_item_id');

        $loadedLines = 0;

        foreach ($items as $voucherItem) {
            $qty = (float) $voucherItem->qty;
            $allocated = (float) ($allocMap[$voucherItem->id] ?? 0);
            $remaining = round(max(0, $qty - $allocated), 3);
            if ($remaining < 0.0001) {
                continue;
            }

            $existing = TripItem::query()
                ->where('trip_id', $tripLocked->id)
                ->where('organization_id', $organizationId)
                ->where('voucher_item_id', $voucherItem->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->loaded_qty = round((float) $existing->loaded_qty + $remaining, 3);
                $existing->save();
            } else {
                TripItem::query()->create([
                    'organization_id' => $organizationId,
                    'trip_id' => $tripLocked->id,
                    'voucher_item_id' => $voucherItem->id,
                    'trip_stop_id' => null,
                    'loaded_qty' => $remaining,
                    'delivered_qty' => 0,
                    'status' => 'LOADED',
                ]);
            }

            $this->refreshVoucherItemLoadedQty($voucherItem);
            $loadedLines++;
        }

        if ($loadedLines === 0) {
            throw ValidationException::withMessages([
                'voucher_id' => ['There is no remaining quantity to load on this voucher.'],
            ]);
        }

        AuditLogger::record($actor, 'trip.voucher_load', $tripLocked, [
            'trip_no' => $tripLocked->trip_no,
            'voucher_id' => $voucher->id,
            'voucher_no' => $voucher->voucher_no,
            'loaded_lines' => $loadedLines,
        ]);

        $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucher->id], $actor);

        return $loadedLines;
    }

    public function syncStops(Request $request, string $trip): RedirectResponse
    {
        abort(404);

        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.id' => ['nullable', 'integer'],
            'stops.*.warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'stops.*.location_name' => ['nullable', 'string', 'max:255'],
            'stops.*.city' => ['nullable', 'string', 'max:128'],
            'stops.*.address' => ['nullable', 'string', 'max:500'],
        ]);

        foreach ($validated['stops'] as $index => $stop) {
            $hasWarehouse = filled($stop['warehouse_id'] ?? null);
            $hasPlace = filled($stop['location_name'] ?? null)
                || filled($stop['city'] ?? null)
                || filled($stop['address'] ?? null);
            if (! $hasWarehouse && ! $hasPlace) {
                return Redirect::back()
                    ->withInput()
                    ->withErrors(['stops.'.$index => 'Each stop needs a warehouse or at least one of location name, city, or address.']);
            }
        }

        $this->validateStopWarehousesForRouting($actor, $validated['stops']);

        try {
            DB::transaction(function () use ($validated, $organizationId, $trip, $actor) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING'], true)) {
                    throw ValidationException::withMessages([
                        'stops' => ['Stops can only be edited while the trip is planned or loading.'],
                    ]);
                }

                $payloadIds = [];
                foreach ($validated['stops'] as $row) {
                    if (! empty($row['id'])) {
                        $payloadIds[] = (int) $row['id'];
                    }
                }

                $existingById = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                foreach ($payloadIds as $pid) {
                    if (! $existingById->has($pid)) {
                        throw ValidationException::withMessages([
                            'stops' => ['One of the stop IDs does not belong to this trip.'],
                        ]);
                    }
                }

                $toDelete = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->whereNotIn('id', $payloadIds)
                    ->lockForUpdate()
                    ->get();

                foreach ($toDelete as $removeStop) {
                    if ($removeStop->tripItems()->exists()) {
                        throw ValidationException::withMessages([
                            'stops' => [
                                'Cannot remove a stop that still has cargo assigned. Remove or reassign trip items first (stop order '
                                    .$removeStop->stop_order.').',
                            ],
                        ]);
                    }
                    $removeStop->delete();
                }

                $n = count($validated['stops']);
                foreach (array_values($validated['stops']) as $i => $row) {
                    $tempOrder = 100000 + $i;
                    $fields = [
                        'stop_order' => $tempOrder,
                        'warehouse_id' => $row['warehouse_id'] ?? null,
                        'location_name' => $row['location_name'] ?? null,
                        'city' => $row['city'] ?? null,
                        'address' => $row['address'] ?? null,
                    ];
                    if (! empty($row['id'])) {
                        $stop = TripStop::query()
                            ->whereKey($row['id'])
                            ->where('trip_id', $tripLocked->id)
                            ->where('organization_id', $organizationId)
                            ->firstOrFail();
                        $stop->update($fields);
                    } else {
                        TripStop::query()->create(array_merge($fields, [
                            'organization_id' => $organizationId,
                            'trip_id' => $tripLocked->id,
                            'status' => 'PENDING',
                        ]));
                    }
                }

                $ordered = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->orderBy('stop_order')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                if ($ordered->count() !== $n) {
                    throw ValidationException::withMessages([
                        'stops' => ['Stop sync failed: unexpected row count.'],
                    ]);
                }

                foreach ($ordered as $idx => $stopRow) {
                    $stopRow->update(['stop_order' => $idx + 1]);
                }

                AuditLogger::record($actor, 'trip.stops_sync', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'stop_count' => $n,
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Trip stops updated.');
    }

    public function updateItem(Request $request, string $trip, string $tripItem): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'loaded_qty' => ['required', 'numeric', 'min:0.001'],
            'trip_stop_id' => ['nullable', 'integer'],
        ]);

        try {
            DB::transaction(function () use ($validated, $organizationId, $trip, $tripItem, $actor) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'loaded_qty' => ['Cargo cannot be edited in this trip status.'],
                    ]);
                }

                $item = TripItem::query()
                    ->whereKey($tripItem)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ((float) $item->delivered_qty > 0.0001) {
                    throw ValidationException::withMessages([
                        'loaded_qty' => ['This line already has delivered quantity; unload or adjust via delivery workflow when implemented.'],
                    ]);
                }

                $tripStopId = $validated['trip_stop_id'] ?? null;
                if ($tripStopId !== null && ! TripStop::query()
                    ->whereKey($tripStopId)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'trip_stop_id' => ['Pick a stop that belongs to this trip.'],
                    ]);
                }

                $newQty = round((float) $validated['loaded_qty'], 3);
                $oldLoaded = (float) $item->loaded_qty;

                $duplicate = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('voucher_item_id', $item->voucher_item_id)
                    ->where('id', '!=', $item->id)
                    ->when(
                        $tripStopId !== null,
                        fn ($q) => $q->where('trip_stop_id', $tripStopId),
                        fn ($q) => $q->whereNull('trip_stop_id')
                    )
                    ->exists();

                if ($duplicate) {
                    throw ValidationException::withMessages([
                        'trip_stop_id' => ['Another cargo row on this trip already uses this stop for the same voucher line. Edit that row or remove one.'],
                    ]);
                }

                $voucherItem = VoucherItem::query()
                    ->whereKey($item->voucher_item_id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $allocatedOther = (float) TripItem::query()
                    ->where('voucher_item_id', $voucherItem->id)
                    ->where('id', '!=', $item->id)
                    ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
                    ->sum('loaded_qty');

                $qty = (float) $voucherItem->qty;
                if ($allocatedOther + $newQty > $qty + 0.0001) {
                    $remaining = max(0, $qty - $allocatedOther);
                    throw ValidationException::withMessages([
                        'loaded_qty' => [
                            'Quantity exceeds remaining on this voucher line (max for this row: '
                                .number_format($remaining, 3).' '.$voucherItem->unit.').',
                        ],
                    ]);
                }

                $item->update([
                    'loaded_qty' => $newQty,
                    'trip_stop_id' => $tripStopId,
                ]);

                $this->refreshVoucherItemLoadedQty($voucherItem);

                $delta = round($newQty - $oldLoaded, 3);

                AuditLogger::record($actor, 'trip_item.update', $item->fresh(), [
                    'trip_no' => $tripLocked->trip_no,
                    'voucher_item_id' => $voucherItem->id,
                    'loaded_qty' => $newQty,
                    'trip_stop_id' => $tripStopId,
                ]);

                $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucherItem->voucher_id], $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Trip cargo updated.');
    }

    public function destroyItem(Request $request, string $trip, string $tripItem): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        try {
            DB::transaction(function () use ($organizationId, $trip, $tripItem, $actor) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'trip' => ['Cargo cannot be removed in this trip status.'],
                    ]);
                }

                $item = TripItem::query()
                    ->whereKey($tripItem)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ((float) $item->delivered_qty > 0.0001) {
                    throw ValidationException::withMessages([
                        'trip' => ['This line has delivered quantity and cannot be removed.'],
                    ]);
                }

                $voucherItemId = $item->voucher_item_id;
                $loadedBeforeRemove = (float) $item->loaded_qty;
                $tripItemIdForStock = (int) $item->id;
                $item->delete();

                $voucherItem = VoucherItem::query()
                    ->whereKey($voucherItemId)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->refreshVoucherItemLoadedQty($voucherItem);

                AuditLogger::record($actor, 'trip_item.remove', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'voucher_item_id' => $voucherItemId,
                    'trip_item_id' => (int) $tripItem,
                ]);

                $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucherItem->voucher_id], $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors());
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Cargo removed from trip.');
    }

    public function updateVoucherStop(Request $request, string $trip, string $voucher): RedirectResponse
    {
        abort(404);

        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'trip_stop_id' => ['nullable', 'integer'],
        ]);

        $tripStopId = $validated['trip_stop_id'] ?? null;

        try {
            DB::transaction(function () use ($organizationId, $trip, $voucher, $actor, $tripStopId) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'trip_stop_id' => ['Trip stop cannot be updated in this trip status.'],
                    ]);
                }

                if ($tripStopId !== null && ! TripStop::query()
                    ->whereKey($tripStopId)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'trip_stop_id' => ['Pick a stop that belongs to this trip.'],
                    ]);
                }

                $voucherId = (int) $voucher;

                $items = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucherId))
                    ->lockForUpdate()
                    ->get();

                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'trip_stop_id' => ['No cargo exists for this voucher on the trip.'],
                    ]);
                }

                foreach ($items as $item) {
                    $item->trip_stop_id = $tripStopId;
                    $item->save();
                }

                AuditLogger::record($actor, 'trip.voucher_stop.update', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'voucher_id' => $voucherId,
                    'trip_stop_id' => $tripStopId,
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Voucher stop updated.');
    }

    public function destroyVoucher(Request $request, string $trip, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherId = (int) $voucher;

        try {
            $removedLines = 0;

            DB::transaction(function () use ($organizationId, $trip, $voucherId, $actor, &$removedLines) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'trip' => ['Cargo cannot be removed in this trip status.'],
                    ]);
                }

                $items = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucherId))
                    ->lockForUpdate()
                    ->get();

                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'trip' => ['No cargo exists for this voucher on the trip.'],
                    ]);
                }

                foreach ($items as $item) {
                    if ((float) $item->delivered_qty > 0.0001) {
                        throw ValidationException::withMessages([
                            'trip' => ['This voucher has delivered quantity and cannot be removed.'],
                        ]);
                    }
                }

                foreach ($items as $item) {
                    $voucherItemId = (int) $item->voucher_item_id;
                    $loadedBeforeRemove = (float) $item->loaded_qty;
                    $tripItemIdForStock = (int) $item->id;
                    $item->delete();

                    $voucherItem = VoucherItem::query()
                        ->whereKey($voucherItemId)
                        ->where('organization_id', $organizationId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $this->refreshVoucherItemLoadedQty($voucherItem);

                    $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucherItem->voucher_id], $actor);
                    $removedLines++;
                }

                AuditLogger::record($actor, 'trip.voucher_unload', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'voucher_id' => $voucherId,
                    'removed_lines' => $removedLines,
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors());
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', $removedLines === 1 ? 'Removed 1 cargo line.' : "Removed {$removedLines} cargo lines.");
    }

    public function storeVoucherDeliveryConfirmations(Request $request, string $trip, string $voucher): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $voucherId = (int) $voucher;

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $note = isset($validated['note']) && trim((string) $validated['note']) !== '' ? trim((string) $validated['note']) : null;

        try {
            $linesConfirmed = 0;

            DB::transaction(function () use ($organizationId, $trip, $voucherId, $actor, $note, &$linesConfirmed) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'note' => ['Delivery can only be confirmed before the trip is completed or cancelled.'],
                    ]);
                }

                $items = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->whereHas('voucherItem', fn ($q) => $q->where('voucher_id', $voucherId))
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'note' => ['No cargo exists for this voucher on the trip.'],
                    ]);
                }

                foreach ($items as $item) {
                    $loaded = (float) $item->loaded_qty;
                    $deliveredBefore = (float) $item->delivered_qty;
                    $remaining = round($loaded - $deliveredBefore, 3);

                    if ($remaining < 0.0001) {
                        continue;
                    }

                    $receivedQty = $remaining;

                    $item->delivered_qty = round(min($deliveredBefore + $receivedQty, $loaded), 3);
                    if ($item->delivered_qty >= $loaded - 0.0001) {
                        $item->status = 'DELIVERED';
                    } else {
                        $item->status = 'PARTIALLY_DELIVERED';
                    }
                    $item->save();

                    $confirmation = DeliveryConfirmation::query()->create([
                        'organization_id' => $organizationId,
                        'trip_item_id' => $item->id,
                        'received_qty' => $receivedQty,
                        'received_by_user_id' => $actor->id,
                        'received_by_name' => null,
                        'received_at' => now(),
                        'note' => $note,
                        'delivery_status' => 'FULL',
                    ]);

                    $voucherItem = VoucherItem::query()
                        ->whereKey($item->voucher_item_id)
                        ->where('organization_id', $organizationId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $this->refreshVoucherItemDeliveredQty($voucherItem);

                    $this->handleWarehouseDestinationReceipt(
                        voucherItem: $voucherItem,
                        tripItem: $item,
                        confirmation: $confirmation,
                        actor: $actor,
                        note: $note
                    );

                    AuditLogger::record($actor, 'delivery_confirmation.record', $confirmation, [
                        'trip_no' => $tripLocked->trip_no,
                        'trip_item_id' => $item->id,
                        'received_qty' => $receivedQty,
                        'delivery_status' => 'FULL',
                        'voucher_batch' => true,
                        'voucher_id' => $voucherId,
                    ]);

                    $linesConfirmed++;
                    $this->touchTripStopAfterDelivery($tripLocked, $item->trip_stop_id, $organizationId);
                }

                if ($linesConfirmed === 0) {
                    throw ValidationException::withMessages([
                        'note' => ['There is no remaining quantity to deliver on this voucher.'],
                    ]);
                }

                $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [$voucherId], $actor);
                $this->tryCompleteTripAfterDelivery($tripLocked, $organizationId, $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', $linesConfirmed === 1
                ? 'Delivery confirmed for 1 cargo line.'
                : "Delivery confirmed for {$linesConfirmed} cargo lines.");
    }

    /**
     * One action: deliver the full remaining quantity on every trip item that still has a balance.
     */
    public function storeTripDeliveryConfirmations(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $note = isset($validated['note']) && trim($validated['note']) !== '' ? trim($validated['note']) : null;

        try {
            $linesConfirmed = 0;

            DB::transaction(function () use ($organizationId, $trip, $actor, $note, &$linesConfirmed) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'note' => ['Delivery can only be confirmed before the trip is completed or cancelled.'],
                    ]);
                }

                $items = TripItem::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                foreach ($items as $item) {
                    $loaded = (float) $item->loaded_qty;
                    $deliveredBefore = (float) $item->delivered_qty;
                    $remaining = round($loaded - $deliveredBefore, 3);

                    if ($remaining < 0.0001) {
                        continue;
                    }

                    $receivedQty = $remaining;

                    $item->delivered_qty = round(min($deliveredBefore + $receivedQty, $loaded), 3);
                    if ($item->delivered_qty >= $loaded - 0.0001) {
                        $item->status = 'DELIVERED';
                    } else {
                        $item->status = 'PARTIALLY_DELIVERED';
                    }
                    $item->save();

                    $confirmation = DeliveryConfirmation::query()->create([
                        'organization_id' => $organizationId,
                        'trip_item_id' => $item->id,
                        'received_qty' => $receivedQty,
                        'received_by_user_id' => $actor->id,
                        'received_by_name' => null,
                        'received_at' => now(),
                        'note' => $note,
                        'delivery_status' => 'FULL',
                    ]);

                    $voucherItem = VoucherItem::query()
                        ->whereKey($item->voucher_item_id)
                        ->where('organization_id', $organizationId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $this->refreshVoucherItemDeliveredQty($voucherItem);

                    $this->handleWarehouseDestinationReceipt(
                        voucherItem: $voucherItem,
                        tripItem: $item,
                        confirmation: $confirmation,
                        actor: $actor,
                        note: $note
                    );

                    AuditLogger::record($actor, 'delivery_confirmation.record', $confirmation, [
                        'trip_no' => $tripLocked->trip_no,
                        'trip_item_id' => $item->id,
                        'received_qty' => $receivedQty,
                        'delivery_status' => 'FULL',
                        'trip_batch' => true,
                    ]);

                    $linesConfirmed++;
                }

                if ($linesConfirmed === 0) {
                    throw ValidationException::withMessages([
                        'note' => ['There is no remaining quantity to deliver on this trip.'],
                    ]);
                }

                $stops = TripStop::query()
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->orderBy('stop_order')
                    ->lockForUpdate()
                    ->get();

                foreach ($stops as $stop) {
                    if ($stop->status === 'SKIPPED') {
                        continue;
                    }
                    if ($stop->arrival_time === null) {
                        $stop->arrival_time = now();
                    }
                    if ($stop->departure_time === null) {
                        $stop->departure_time = now();
                    }
                    $stop->status = 'COMPLETED';
                    $stop->save();
                }

                $tripLocked->status = 'COMPLETED';
                if ($tripLocked->arrived_at === null) {
                    $tripLocked->arrived_at = now();
                }
                $tripLocked->save();

                AuditLogger::record($actor, 'trip.status_transition', $tripLocked, [
                    'trip_no' => $tripLocked->trip_no,
                    'status_to' => 'COMPLETED',
                    'trip_batch' => true,
                ]);

                $this->voucherOperationalStatusSync->syncForTrip($organizationId, (int) $tripLocked->id, $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', $linesConfirmed === 1
                ? 'Delivery confirmed for 1 cargo line.'
                : "Delivery confirmed for {$linesConfirmed} cargo lines.");
    }

    /**
     * Record delivery for a single trip item (partial, full remaining, or rejected).
     */
    public function storeDeliveryConfirmation(Request $request, string $trip, string $tripItem): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'received_qty' => ['required', 'numeric', 'min:0'],
            'delivery_status' => ['required', Rule::in(['FULL', 'PARTIAL', 'REJECTED'])],
            'received_by_name' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $receivedQty = round((float) $validated['received_qty'], 3);
        $status = $validated['delivery_status'];

        if ($status === 'REJECTED' && $receivedQty > 0.0001) {
            throw ValidationException::withMessages([
                'received_qty' => ['Rejected deliveries must use received quantity 0.'],
            ]);
        }

        if (in_array($status, ['FULL', 'PARTIAL'], true) && $receivedQty < 0.001) {
            throw ValidationException::withMessages([
                'received_qty' => ['Enter a positive received quantity for partial or full delivery.'],
            ]);
        }

        try {
            DB::transaction(function () use ($validated, $organizationId, $trip, $tripItem, $actor, $receivedQty, $status) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
                    throw ValidationException::withMessages([
                        'delivery_status' => ['Delivery can only be recorded before the trip is completed or cancelled.'],
                    ]);
                }

                $item = TripItem::query()
                    ->whereKey($tripItem)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $loaded = (float) $item->loaded_qty;
                $deliveredBefore = (float) $item->delivered_qty;
                $remaining = round($loaded - $deliveredBefore, 3);

                if ($status === 'REJECTED') {
                    $confirmation = DeliveryConfirmation::query()->create([
                        'organization_id' => $organizationId,
                        'trip_item_id' => $item->id,
                        'received_qty' => 0,
                        'received_by_user_id' => $actor->id,
                        'received_by_name' => $validated['received_by_name'] ?? null,
                        'received_at' => now(),
                        'note' => $validated['note'] ?? null,
                        'delivery_status' => 'REJECTED',
                    ]);

                    AuditLogger::record($actor, 'delivery_confirmation.reject', $confirmation, [
                        'trip_no' => $tripLocked->trip_no,
                        'trip_item_id' => $item->id,
                    ]);

                    return;
                }

                if (in_array($status, ['FULL', 'PARTIAL'], true) && $remaining < 0.0001) {
                    throw ValidationException::withMessages([
                        'received_qty' => ['Nothing remaining to deliver on this line.'],
                    ]);
                }

                if ($receivedQty > $remaining + 0.0001) {
                    throw ValidationException::withMessages([
                        'received_qty' => [
                            'Received quantity cannot exceed remaining on this cargo line (remaining: '
                                .number_format(max(0, $remaining), 3, '.', '').').',
                        ],
                    ]);
                }

                if ($status === 'FULL' && abs($receivedQty - $remaining) > 0.0001) {
                    throw ValidationException::withMessages([
                        'delivery_status' => ['For a full delivery, received quantity must match the full remaining amount on this line.'],
                    ]);
                }

                if ($status === 'PARTIAL' && ($receivedQty >= $remaining - 0.0001)) {
                    throw ValidationException::withMessages([
                        'delivery_status' => ['Use “Full” when receiving the entire remaining quantity, or enter a smaller quantity for partial.'],
                    ]);
                }

                $newDelivered = round($deliveredBefore + $receivedQty, 3);
                if ($newDelivered > $loaded + 0.0001) {
                    throw ValidationException::withMessages([
                        'received_qty' => ['This receipt would exceed the loaded quantity on the trip.'],
                    ]);
                }

                $item->delivered_qty = min($newDelivered, $loaded);
                if ($item->delivered_qty >= $loaded - 0.0001) {
                    $item->status = 'DELIVERED';
                } else {
                    $item->status = 'PARTIALLY_DELIVERED';
                }
                $item->save();

                $confirmation = DeliveryConfirmation::query()->create([
                    'organization_id' => $organizationId,
                    'trip_item_id' => $item->id,
                    'received_qty' => $receivedQty,
                    'received_by_user_id' => $actor->id,
                    'received_by_name' => $validated['received_by_name'] ?? null,
                    'received_at' => now(),
                    'note' => $validated['note'] ?? null,
                    'delivery_status' => $status,
                ]);

                $voucherItem = VoucherItem::query()
                    ->whereKey($item->voucher_item_id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->refreshVoucherItemDeliveredQty($voucherItem);

                $this->handleWarehouseDestinationReceipt(
                    voucherItem: $voucherItem,
                    tripItem: $item,
                    confirmation: $confirmation,
                    actor: $actor,
                    note: isset($validated['note']) && trim((string) $validated['note']) !== '' ? trim((string) $validated['note']) : null
                );

                AuditLogger::record($actor, 'delivery_confirmation.record', $confirmation, [
                    'trip_no' => $tripLocked->trip_no,
                    'trip_item_id' => $item->id,
                    'received_qty' => $receivedQty,
                    'delivery_status' => $status,
                ]);

                $this->voucherOperationalStatusSync->syncForVoucherIds($organizationId, [(int) $voucherItem->voucher_id], $actor);

                $this->touchTripStopAfterDelivery($tripLocked, $item->trip_stop_id, $organizationId);
                $this->tryCompleteTripAfterDelivery($tripLocked, $organizationId, $actor);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Delivery recorded.');
    }

    private function touchTripStopAfterDelivery(Trip $tripLocked, ?int $tripStopId, int $organizationId): void
    {
        if ($tripStopId === null) {
            return;
        }

        $stop = TripStop::query()
            ->whereKey($tripStopId)
            ->where('trip_id', $tripLocked->id)
            ->where('organization_id', $organizationId)
            ->lockForUpdate()
            ->first();

        if ($stop === null) {
            return;
        }

        if ($stop->status === 'PENDING') {
            $stop->status = 'ARRIVED';
            if ($stop->arrival_time === null) {
                $stop->arrival_time = now();
            }
            $stop->save();
        }

        $items = TripItem::query()
            ->where('trip_id', $tripLocked->id)
            ->where('organization_id', $organizationId)
            ->where('trip_stop_id', $stop->id)
            ->lockForUpdate()
            ->get(['id', 'loaded_qty', 'delivered_qty']);

        if ($items->isEmpty()) {
            return;
        }

        foreach ($items as $it) {
            $loaded = (float) $it->loaded_qty;
            $delivered = (float) $it->delivered_qty;
            if ($loaded - $delivered > 0.0001) {
                return;
            }
        }

        if ($stop->status !== 'COMPLETED' && $stop->status !== 'SKIPPED') {
            $stop->status = 'COMPLETED';
            if ($stop->arrival_time === null) {
                $stop->arrival_time = now();
            }
            if ($stop->departure_time === null) {
                $stop->departure_time = now();
            }
            $stop->save();
        }
    }

    private function tryCompleteTripAfterDelivery(Trip $tripLocked, int $organizationId, User $actor): void
    {
        if (! in_array($tripLocked->status, ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'], true)) {
            return;
        }

        $items = TripItem::query()
            ->where('trip_id', $tripLocked->id)
            ->where('organization_id', $organizationId)
            ->lockForUpdate()
            ->get(['id', 'loaded_qty', 'delivered_qty']);

        if ($items->isEmpty()) {
            return;
        }

        foreach ($items as $it) {
            $loaded = (float) $it->loaded_qty;
            $delivered = (float) $it->delivered_qty;
            if ($loaded - $delivered > 0.0001) {
                return;
            }
        }

        $stops = TripStop::query()
            ->where('trip_id', $tripLocked->id)
            ->where('organization_id', $organizationId)
            ->orderBy('stop_order')
            ->lockForUpdate()
            ->get();

        foreach ($stops as $stop) {
            if ($stop->status === 'SKIPPED') {
                continue;
            }
            if ($stop->arrival_time === null) {
                $stop->arrival_time = now();
            }
            if ($stop->departure_time === null) {
                $stop->departure_time = now();
            }
            $stop->status = 'COMPLETED';
            $stop->save();
        }

        $tripLocked->status = 'COMPLETED';
        if ($tripLocked->arrived_at === null) {
            $tripLocked->arrived_at = now();
        }
        $tripLocked->save();

        AuditLogger::record($actor, 'trip.status_transition', $tripLocked, [
            'trip_no' => $tripLocked->trip_no,
            'status_to' => 'COMPLETED',
            'auto' => true,
        ]);
    }

    public function manifest(Request $request, string $trip): View
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->whereKey($trip)
            ->where('organization_id', $organizationId)
            ->with([
                'organization:id,name',
                'vehicle:id,vehicle_no,vehicle_type',
                'sourceWarehouse:id,city,address',
                'stops' => fn ($q) => $q->orderBy('stop_order')->with('warehouse:id,city,address'),
                'items' => fn ($q) => $q->orderBy('id')->with([
                    'tripStop:id,stop_order',
                    'voucherItem' => fn ($q2) => $q2->with([
                        'product:id,name,unit',
                        'voucher:id,voucher_no,total_amount,payment_status,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone,default_destination_remark',
                        'voucher.defaultToWarehouse:id,city,address',
                    ]),
                ]),
            ])
            ->firstOrFail();

        $user = $request->user();
        $canMarkPrinted = $user && $user->hasPermission('trips.manage');

        $byVoucher = [];
        foreach ($tripModel->items as $item) {
            $vi = $item->voucherItem;
            if ($vi === null || $vi->voucher === null) {
                continue;
            }

            $voucher = $vi->voucher;
            $voucherId = (int) $voucher->id;

            if (! isset($byVoucher[$voucherId])) {
                $byVoucher[$voucherId] = [
                    'voucher_id' => $voucherId,
                    'voucher_no' => (string) ($voucher->voucher_no ?? '—'),
                    'payment_status' => (string) ($voucher->payment_status ?? 'UNPAID'),
                    'total_amount' => $voucher->total_amount !== null ? (float) $voucher->total_amount : null,
                    'destination' => $this->formatVoucherItemDestinationForManifest($vi),
                    'destination_remark' => $voucher->default_destination_remark !== null
                        ? trim((string) $voucher->default_destination_remark)
                        : null,
                    'items' => [],
                    'items_qty' => 0,
                ];
            }

            $qty = (float) $item->loaded_qty;
            $qtyInt = (int) round($qty, 0);
            $unit = $vi->product->unit ?? $vi->unit ?? '';
            $qtyLabel = number_format($qtyInt, 0, '.', '').($unit !== '' ? ' '.$unit : '');

            $amount = null;
            if ($vi->freight_amount !== null && $vi->freight_amount !== '') {
                $amount = (float) $vi->freight_amount;
            }

            $byVoucher[$voucherId]['items'][] = [
                'product_name' => $vi->product->name ?? '—',
                'qty' => $qtyLabel,
                'amount' => $amount,
            ];
            $byVoucher[$voucherId]['items_qty'] = (int) $byVoucher[$voucherId]['items_qty'] + $qtyInt;
        }

        $voucherIds = array_keys($byVoucher);
        if ($voucherIds !== []) {
            $paidByVoucherId = VoucherPayment::query()
                ->where('organization_id', $organizationId)
                ->whereIn('voucher_id', $voucherIds)
                ->selectRaw('voucher_id, COALESCE(SUM(amount), 0) as paid_amount')
                ->groupBy('voucher_id')
                ->get()
                ->keyBy(fn ($r) => (int) $r->voucher_id)
                ->map(fn ($r) => round((float) $r->paid_amount, 2));

            foreach ($voucherIds as $vid) {
                $byVoucher[$vid]['paid_amount'] = (float) ($paidByVoucherId[$vid] ?? 0.0);
            }
        }

        $cargoRows = array_values($byVoucher);
        usort($cargoRows, fn ($a, $b) => strcmp((string) $b['voucher_no'], (string) $a['voucher_no']));

        foreach ($cargoRows as &$row) {
            $row['total_items_qty'] = (int) ($row['items_qty'] ?? 0);
            if ($row['total_amount'] === null) {
                $sum = 0.0;
                foreach ($row['items'] as $it) {
                    if ($it['amount'] !== null) {
                        $sum += (float) $it['amount'];
                    }
                }
                $row['total_amount'] = round($sum, 2);
            }
        }
        unset($row);

        $totalPaidAmount = round(array_reduce(
            $cargoRows,
            fn (float $carry, array $row): float => $carry + (float) ($row['paid_amount'] ?? 0),
            0.0
        ), 2);

        return view('admin.operations.trips.manifest', [
            'trip' => $tripModel,
            'cargoRows' => $cargoRows,
            'totalPaidAmount' => $totalPaidAmount,
            'canMarkPrinted' => $canMarkPrinted,
            'adminAppUrl' => rtrim((string) config('app.admin_app_url'), '/'),
        ]);
    }

    public function printVouchers(Request $request, string $trip): Response
    {
        return $this->renderTripVoucherPrintPage($request, $trip, false);
    }

    public function printOverviewSlipWithVouchers(Request $request, string $trip): Response
    {
        return $this->renderTripVoucherPrintPage($request, $trip, true);
    }

    private function renderTripVoucherPrintPage(Request $request, string $trip, bool $includeOverviewSlip): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->whereKey($trip)
            ->where('organization_id', $organizationId)
            ->with([
                'vehicle:id,vehicle_no,vehicle_type',
                'sourceWarehouse:id,city,address',
                'stops' => fn ($q) => $q->orderBy('stop_order')->with('warehouse:id,city,address'),
                'items' => fn ($q) => $q->orderBy('id')->with([
                    'tripStop:id,stop_order',
                    'voucherItem' => fn ($q2) => $q2->with([
                        'product:id,name,unit',
                        'voucher:id,voucher_no,total_amount,payment_status,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone,default_destination_remark',
                        'voucher.defaultToWarehouse:id,city,address',
                    ]),
                ]),
            ])
            ->firstOrFail();

        $cargoRows = $this->buildTripCargoRows($tripModel, $organizationId);
        $voucherIds = collect($cargoRows)
            ->pluck('voucher_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        $vouchers = $voucherIds === []
            ? collect()
            : Voucher::query()
                ->where('organization_id', $organizationId)
                ->whereIn('id', $voucherIds)
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
                ->orderByDesc('voucher_no')
                ->get();

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

        $trackingUrls = [];
        foreach ($vouchers as $voucherModel) {
            $trackingUrls[$voucherModel->id] = route('public.voucher.track', [
                'org' => $organization->code,
                'voucherNo' => $voucherModel->voucher_no,
                'locale' => 'my',
            ]);
        }

        $tripPrintSummary = $this->buildTripOverviewSlipData($tripModel, $cargoRows);

        return Inertia::render('Admin/Operations/TripVouchersPrint', [
            'trip' => [
                'id' => $tripModel->id,
                'trip_no' => $tripModel->trip_no,
                'status' => $tripModel->status,
                'driver_name' => $tripModel->driver_name,
                'driver_phone' => $tripModel->driver_phone,
                'remark' => $tripModel->remark,
                'vehicle' => $tripModel->vehicle,
            ],
            'vouchers' => $vouchers,
            'template' => $template,
            'voucher_policy' => trim((string) env('VOUCHER_POLICY', '')),
            'tracking_urls' => $trackingUrls,
            'trip_print_summary' => $tripPrintSummary,
            'overview_slip' => $includeOverviewSlip ? $tripPrintSummary : null,
        ]);
    }

    public function markManifestPrinted(Request $request, string $trip): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $tripModel = Trip::query()
            ->whereKey($trip)
            ->where('organization_id', $organizationId)
            ->firstOrFail();

        $tripModel->update(['manifest_printed_at' => now()]);

        AuditLogger::record($actor, 'trip.manifest_print', $tripModel, [
            'trip_no' => $tripModel->trip_no,
        ]);

        return Redirect::route('admin.trips.manifest', $tripModel)
            ->with('success', 'Manifest print recorded.');
    }

    private function formatVoucherItemDestinationForManifest(VoucherItem $vi): string
    {
        $voucher = $vi->voucher;
        if ($voucher === null) {
            return '—';
        }

        $bits = [];
        if (filled($voucher->default_recipient_name)) {
            $bits[] = $voucher->default_recipient_name;
        }
        if (filled($voucher->default_recipient_phone)) {
            $bits[] = $voucher->default_recipient_phone;
        }
        $addrParts = array_filter([
            $voucher->default_to_address_line1,
            $voucher->default_to_address_line2,
            $voucher->default_to_township,
            $voucher->default_to_city,
            $voucher->default_to_region,
            $voucher->default_to_postal_code,
        ], fn ($v) => $v !== null && trim((string) $v) !== '');
        if ($addrParts !== []) {
            $bits[] = implode(', ', $addrParts);
        }

        return $bits === [] ? '—' : implode(' · ', $bits);
    }

    private function buildTripCargoRows(Trip $tripModel, int $organizationId): array
    {
        $byVoucher = [];
        foreach ($tripModel->items as $item) {
            $vi = $item->voucherItem;
            if ($vi === null || $vi->voucher === null) {
                continue;
            }

            $voucher = $vi->voucher;
            $voucherId = (int) $voucher->id;

            if (! isset($byVoucher[$voucherId])) {
                $recipientBits = array_filter([
                    trim((string) ($voucher->default_recipient_name ?? '')),
                    trim((string) ($voucher->default_recipient_phone ?? '')),
                ]);
                $destinationWarehouseLabel = trim((string) ($voucher->defaultToWarehouse?->display_name ?? $voucher->defaultToWarehouse?->city ?? ''));

                $byVoucher[$voucherId] = [
                    'voucher_id' => $voucherId,
                    'voucher_no' => (string) ($voucher->voucher_no ?? '—'),
                    'payment_status' => (string) ($voucher->payment_status ?? 'UNPAID'),
                    'total_amount' => $voucher->total_amount !== null ? (float) $voucher->total_amount : null,
                    'destination' => $this->formatVoucherItemDestinationForManifest($vi),
                    'recipient_label' => $recipientBits === [] ? '—' : implode(' · ', $recipientBits),
                    'destination_warehouse_label' => $destinationWarehouseLabel !== '' ? $destinationWarehouseLabel : '—',
                    'destination_remark' => $voucher->default_destination_remark !== null
                        ? trim((string) $voucher->default_destination_remark)
                        : null,
                    'items' => [],
                    'items_qty' => 0,
                ];
            }

            $qty = (float) $item->loaded_qty;
            $qtyInt = (int) round($qty, 0);
            $unit = $vi->product->unit ?? $vi->unit ?? '';
            $qtyLabel = number_format($qtyInt, 0, '.', '').($unit !== '' ? ' '.$unit : '');

            $amount = null;
            if ($vi->freight_amount !== null && $vi->freight_amount !== '') {
                $amount = (float) $vi->freight_amount;
            }

            $byVoucher[$voucherId]['items'][] = [
                'product_name' => $vi->product->name ?? '—',
                'qty' => $qtyLabel,
                'amount' => $amount,
            ];
            $byVoucher[$voucherId]['items_qty'] = (int) $byVoucher[$voucherId]['items_qty'] + $qtyInt;
        }

        $voucherIds = array_keys($byVoucher);
        if ($voucherIds !== []) {
            $paidByVoucherId = VoucherPayment::query()
                ->where('organization_id', $organizationId)
                ->whereIn('voucher_id', $voucherIds)
                ->selectRaw('voucher_id, COALESCE(SUM(amount), 0) as paid_amount')
                ->groupBy('voucher_id')
                ->get()
                ->keyBy(fn ($r) => (int) $r->voucher_id)
                ->map(fn ($r) => round((float) $r->paid_amount, 2));

            foreach ($voucherIds as $vid) {
                $byVoucher[$vid]['paid_amount'] = (float) ($paidByVoucherId[$vid] ?? 0.0);
            }
        }

        $cargoRows = array_values($byVoucher);
        usort($cargoRows, fn ($a, $b) => strcmp((string) $b['voucher_no'], (string) $a['voucher_no']));

        foreach ($cargoRows as &$row) {
            $row['total_items_qty'] = (int) ($row['items_qty'] ?? 0);
            if ($row['total_amount'] === null) {
                $sum = 0.0;
                foreach ($row['items'] as $it) {
                    if ($it['amount'] !== null) {
                        $sum += (float) $it['amount'];
                    }
                }
                $row['total_amount'] = round($sum, 2);
            }
        }
        unset($row);

        return $cargoRows;
    }

    private function buildTripOverviewSlipData(Trip $tripModel, array $cargoRows): array
    {
        $voucherCount = count($cargoRows);
        $totalLoadedQty = 0;
        $totalAmount = 0.0;
        $paidAmount = 0.0;

        foreach ($cargoRows as $row) {
            $totalLoadedQty += (int) ($row['total_items_qty'] ?? 0);
            $totalAmount += (float) ($row['total_amount'] ?? 0);
            $paidAmount += (float) ($row['paid_amount'] ?? 0);
        }

        $destinationWarehouse = optional(optional($tripModel->stops->last())->warehouse)->display_name
            ?? optional(optional($tripModel->stops->last())->warehouse)->city
            ?? $tripModel->sourceWarehouse->display_name
            ?? $tripModel->sourceWarehouse->city
            ?? '—';

        return [
            'title' => 'Trip Overview Slip',
            'trip_no' => $tripModel->trip_no,
            'status' => $tripModel->status,
            'remark' => $tripModel->remark,
            'vehicle_label' => $tripModel->vehicle
                ? trim(implode(' · ', array_filter([
                    $tripModel->vehicle->vehicle_no,
                    $tripModel->vehicle->vehicle_type,
                ])))
                : '—',
            'driver_label' => trim(implode(' · ', array_filter([
                $tripModel->driver_name,
                $tripModel->driver_phone,
            ]))) ?: '—',
            'destination_label' => $destinationWarehouse,
            'manifest_printed_at' => $tripModel->manifest_printed_at?->timezone(config('app.timezone'))?->format('Y-m-d H:i'),
            'generated_at' => now()->timezone(config('app.timezone'))->format('Y-m-d H:i'),
            'voucher_count' => $voucherCount,
            'total_loaded_qty' => $totalLoadedQty,
            'total_amount' => round($totalAmount, 2),
            'paid_amount' => round($paidAmount, 2),
            'rows' => array_map(function (array $row) {
                $totalAmount = round((float) ($row['total_amount'] ?? 0), 2);
                $paidAmount = round((float) ($row['paid_amount'] ?? 0), 2);

                return [
                    'voucher_id' => (int) ($row['voucher_id'] ?? 0),
                    'voucher_no' => (string) ($row['voucher_no'] ?? '—'),
                    'recipient_label' => (string) ($row['recipient_label'] ?? '—'),
                    'destination_warehouse_label' => (string) ($row['destination_warehouse_label'] ?? '—'),
                    'total_items_qty' => (int) ($row['total_items_qty'] ?? 0),
                    'total_amount' => $totalAmount,
                    'paid_amount' => $paidAmount,
                    'outstanding_amount' => max(0, round($totalAmount - $paidAmount, 2)),
                ];
            }, $cargoRows),
        ];
    }

    private function refreshVoucherItemLoadedQty(VoucherItem $voucherItem): void
    {
        $sum = (float) TripItem::query()
            ->where('voucher_item_id', $voucherItem->id)
            ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
            ->sum('loaded_qty');
        $voucherItem->update(['loaded_qty' => round($sum, 3)]);
    }

    private function refreshVoucherItemDeliveredQty(VoucherItem $voucherItem): void
    {
        $sum = (float) TripItem::query()
            ->where('voucher_item_id', $voucherItem->id)
            ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
            ->sum('delivered_qty');
        $voucherItem->update(['delivered_qty' => round($sum, 3)]);
    }

    /**
     * Stock receipt warehouse: prefer {@see TripStop::$warehouse_id} when the trip item has a stop;
     * otherwise voucher default destination warehouse.
     */
    private function resolveReceivingWarehouseId(TripItem $tripItem, VoucherItem $voucherItem, int $organizationId): ?int
    {
        if ($tripItem->trip_stop_id !== null) {
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

    private function handleWarehouseDestinationReceipt(
        VoucherItem $voucherItem,
        TripItem $tripItem,
        DeliveryConfirmation $confirmation,
        User $actor,
        ?string $note = null
    ): void {
        if ($confirmation->delivery_status === 'REJECTED' || (float) $confirmation->received_qty < 0.0001) {
            return;
        }

        $receivingWarehouseId = $this->resolveReceivingWarehouseId($tripItem, $voucherItem, (int) $voucherItem->organization_id);
        if ($receivingWarehouseId === null) {
            return;
        }

        $instruction = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $voucherItem->organization_id)
            ->where('trip_item_id', $tripItem->id)
            ->where('warehouse_id', $receivingWarehouseId)
            ->where('voucher_item_id', $voucherItem->id)
            ->lockForUpdate()
            ->first();

        if (! $instruction) {
            $instruction = WarehouseFulfillmentInstruction::query()->create([
                'organization_id' => $voucherItem->organization_id,
                'warehouse_id' => $receivingWarehouseId,
                'trip_item_id' => $tripItem->id,
                'voucher_item_id' => $voucherItem->id,
                'merchant_id' => $voucherItem->voucher?->merchant_id,
                'qty_received' => 0,
                'qty_dispatched' => 0,
                'status' => 'PENDING_ACTION',
                'last_updated_by' => $actor->id,
            ]);
        }

        $instruction->qty_received = round((float) $instruction->qty_received + (float) $confirmation->received_qty, 3);
        $instruction->status = ((float) $instruction->qty_received - (float) $instruction->qty_dispatched) > 0.0001
            ? 'PENDING_ACTION'
            : 'COMPLETED';
        if ($note !== null) {
            $instruction->note = $note;
        }
        $instruction->last_updated_by = $actor->id;
        $instruction->save();
    }

    /**
     * Destination warehouse receives previously delivered quantity into stock.
     */
    public function storeDestinationReceipt(Request $request, string $trip, string $tripItem): RedirectResponse
    {
        return Redirect::back()->with('error', 'Stock management is disabled.');
    }

    private function withPendingReceiptQtyForTripItems(Collection $items, int $organizationId): Collection
    {
        foreach ($items as $item) {
            $item->pending_receipt_qty = '0.000';
        }
        return $items;
    }

    /**
     * @return list<array{id:int,voucher_no:string,line_no:int,product_name:string,unit:string,qty:string,remaining_qty:string}>
     */
    private function loadableVoucherItems(Trip $trip, int $organizationId): array
    {
        $destinationWarehouseId = TripStop::query()
            ->where('trip_id', $trip->id)
            ->where('organization_id', $organizationId)
            ->orderBy('stop_order')
            ->value('warehouse_id');
        if ($destinationWarehouseId === null) {
            return [];
        }

        $items = VoucherItem::query()
            ->where('organization_id', $organizationId)
            ->whereHas('voucher', fn ($q) => $q
                ->whereIn('status', self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD)
                ->where('default_to_warehouse_id', $destinationWarehouseId))
            ->with([
                'product:id,name,unit',
                'voucher:id,voucher_no',
            ])
            ->orderByDesc('voucher_id')
            ->orderBy('line_no')
            ->limit(300)
            ->get();

        if ($items->isEmpty()) {
            return [];
        }

        $allocMap = TripItem::query()
            ->whereIn('voucher_item_id', $items->pluck('id'))
            ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
            ->selectRaw('voucher_item_id, SUM(loaded_qty) as allocated')
            ->groupBy('voucher_item_id')
            ->pluck('allocated', 'voucher_item_id');

        $out = [];
        foreach ($items as $vi) {
            $qty = (float) $vi->qty;
            $allocated = (float) ($allocMap[$vi->id] ?? 0);
            $remaining = max(0, $qty - $allocated);
            if ($remaining <= 0) {
                continue;
            }
            $out[] = [
                'id' => $vi->id,
                'voucher_no' => $vi->voucher->voucher_no,
                'line_no' => $vi->line_no,
                'product_name' => $vi->product->name,
                'unit' => $vi->product->unit ?? $vi->unit,
                'qty' => (string) $vi->qty,
                'remaining_qty' => number_format($remaining, 3, '.', ''),
            ];
        }

        return $out;
    }

    /**
     * @return list<array{id:int,voucher_no:string,merchant_name:string|null,recipient_name:string|null,total_weight:float|null,remaining_qty:string,lines:int,line_rows:list<array{id:int,line_no:int,product_name:string,unit:string|null,remaining_qty:string}>}>
     */
    private function loadableVouchers(Trip $trip, int $organizationId): array
    {
        $destinationWarehouseId = TripStop::query()
            ->where('trip_id', $trip->id)
            ->where('organization_id', $organizationId)
            ->orderBy('stop_order')
            ->value('warehouse_id');
        if ($destinationWarehouseId === null) {
            return [];
        }

        $items = VoucherItem::query()
            ->where('organization_id', $organizationId)
            ->whereHas('voucher', fn ($q) => $q
                ->whereIn('status', self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD)
                ->where('default_to_warehouse_id', $destinationWarehouseId))
            ->with([
                'product:id,name,unit',
                'voucher:id,voucher_no,merchant_id,total_weight,default_recipient_name',
                'voucher.merchant:id,name',
            ])
            ->orderByDesc('voucher_id')
            ->orderBy('line_no')
            ->limit(800)
            ->get();

        if ($items->isEmpty()) {
            return [];
        }

        $merchantIds = $items
            ->pluck('voucher')
            ->filter()
            ->pluck('merchant_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $merchantMap = $merchantIds !== []
            ? Merchant::query()
                ->where('organization_id', $organizationId)
                ->whereIn('id', $merchantIds)
                ->pluck('name', 'id')
            : collect();

        $allocMap = TripItem::query()
            ->whereIn('voucher_item_id', $items->pluck('id'))
            ->whereHas('trip', fn ($q) => $q->where('status', '!=', 'CANCELLED'))
            ->selectRaw('voucher_item_id, SUM(loaded_qty) as allocated')
            ->groupBy('voucher_item_id')
            ->pluck('allocated', 'voucher_item_id');

        $byVoucher = [];
        foreach ($items as $vi) {
            if ($vi->voucher === null) {
                continue;
            }
            $qty = (float) $vi->qty;
            $allocated = (float) ($allocMap[$vi->id] ?? 0);
            $remaining = max(0, $qty - $allocated);
            if ($remaining <= 0) {
                continue;
            }

            $vid = (int) $vi->voucher_id;
            if (! isset($byVoucher[$vid])) {
                $byVoucher[$vid] = [
                    'id' => $vid,
                    'voucher_no' => (string) $vi->voucher->voucher_no,
                    'merchant_name' => $vi->voucher->merchant_id !== null
                        ? $merchantMap->get((int) $vi->voucher->merchant_id)
                        : null,
                    'recipient_name' => $vi->voucher->default_recipient_name !== null
                        ? (string) $vi->voucher->default_recipient_name
                        : null,
                    'total_weight' => $vi->voucher->total_weight !== null ? (float) $vi->voucher->total_weight : null,
                    'remaining' => 0.0,
                    'lines' => 0,
                    'line_rows' => [],
                ];
            }
            $byVoucher[$vid]['remaining'] = (float) $byVoucher[$vid]['remaining'] + (float) $remaining;
            $byVoucher[$vid]['lines'] = (int) $byVoucher[$vid]['lines'] + 1;
            $byVoucher[$vid]['line_rows'][] = [
                'id' => (int) $vi->id,
                'line_no' => (int) $vi->line_no,
                'product_name' => (string) ($vi->product?->name ?? '—'),
                'unit' => $vi->product?->unit ?? $vi->unit,
                'remaining_qty' => number_format($remaining, 3, '.', ''),
            ];
        }

        $out = array_values($byVoucher);
        usort($out, fn ($a, $b) => strcmp($b['voucher_no'], $a['voucher_no']));

        return array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'voucher_no' => (string) $row['voucher_no'],
                'merchant_name' => isset($row['merchant_name']) ? (string) $row['merchant_name'] : null,
                'recipient_name' => isset($row['recipient_name']) ? (string) $row['recipient_name'] : null,
                'total_weight' => $row['total_weight'] ?? null,
                'remaining_qty' => number_format(max(0, (float) $row['remaining']), 3, '.', ''),
                'lines' => (int) $row['lines'],
                'line_rows' => $row['line_rows'],
            ];
        }, $out);
    }

    /**
     * @param  array<string, mixed>  $vehiclePayload
     */
    private function resolveVehicleForTrip(User $actor, int $organizationId, array $vehiclePayload, ?int $vehicleId): Vehicle
    {
        $vehicleNo = strtoupper(trim((string) ($vehiclePayload['vehicle_no'] ?? '')));
        $capW = array_key_exists('capacity_weight', $vehiclePayload)
            && $vehiclePayload['capacity_weight'] !== null
            && $vehiclePayload['capacity_weight'] !== ''
            ? round((float) $vehiclePayload['capacity_weight'], 2)
            : null;
        $type = array_key_exists('vehicle_type', $vehiclePayload) ? trim((string) $vehiclePayload['vehicle_type']) : '';

        if ($vehicleId !== null) {
            $vehicle = Vehicle::query()
                ->whereKey($vehicleId)
                ->where('organization_id', $organizationId)
                ->whereNull('deleted_at')
                ->firstOrFail();

            if ($vehicle->status !== 'ACTIVE') {
                throw ValidationException::withMessages([
                    'vehicle.vehicle_no' => ['This vehicle is not active. Activate it under Master → Vehicles before assigning trips.'],
                ]);
            }

            if ($this->vehicleNumberTaken($organizationId, $vehicleNo, $vehicle->id)) {
                throw ValidationException::withMessages([
                    'vehicle.vehicle_no' => ['Another vehicle already uses this registration number.'],
                ]);
            }

            $vehicle->fill([
                'vehicle_no' => $vehicleNo,
                'vehicle_type' => $type !== '' ? $type : $vehicle->vehicle_type,
                'capacity_weight' => $capW,
            ]);
            $vehicle->save();

            AuditLogger::record($actor, 'vehicle.update', $vehicle, [
                'vehicle_no' => $vehicle->vehicle_no,
                'context' => 'trip_create',
            ]);

            return $vehicle;
        }

        $existing = Vehicle::query()
            ->where('organization_id', $organizationId)
            ->whereNull('deleted_at')
            ->whereRaw('UPPER(vehicle_no) = ?', [$vehicleNo])
            ->first();

        if ($existing !== null) {
            if ($existing->status !== 'ACTIVE') {
                throw ValidationException::withMessages([
                    'vehicle.vehicle_no' => ['This vehicle is not active. Activate it under Master → Vehicles before assigning trips.'],
                ]);
            }

            if ($this->vehicleNumberTaken($organizationId, $vehicleNo, $existing->id)) {
                throw ValidationException::withMessages([
                    'vehicle.vehicle_no' => ['Another vehicle already uses this registration number.'],
                ]);
            }

            $existing->fill([
                'vehicle_no' => $vehicleNo,
                'vehicle_type' => $type !== '' ? $type : $existing->vehicle_type,
                'capacity_weight' => $capW,
            ]);
            $existing->save();

            AuditLogger::record($actor, 'vehicle.update', $existing, [
                'vehicle_no' => $existing->vehicle_no,
                'context' => 'trip_create',
            ]);

            return $existing;
        }

        if ($this->vehicleNumberTaken($organizationId, $vehicleNo, null)) {
            throw ValidationException::withMessages([
                'vehicle.vehicle_no' => ['Another vehicle already uses this registration number.'],
            ]);
        }

        $vehicle = Vehicle::query()->create([
            'organization_id' => $organizationId,
            'vehicle_no' => $vehicleNo,
            'vehicle_type' => $type !== '' ? $type : 'GENERAL',
            'capacity_weight' => $capW,
            'status' => 'ACTIVE',
        ]);

        AuditLogger::record($actor, 'vehicle.create', $vehicle, [
            'vehicle_no' => $vehicle->vehicle_no,
            'context' => 'trip_create',
        ]);

        return $vehicle;
    }

    /**
     * @param  array<int, array<string, mixed>>  $stops
     */
    private function validateTripOperationalWarehouses(User $actor, int $sourceWarehouseId, array $stops): void
    {
        $operatingIds = $this->operationalContext->operatingWarehouses($actor)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! in_array($sourceWarehouseId, $operatingIds, true)) {
            throw ValidationException::withMessages([
                'source_warehouse_id' => ['You cannot create trips from this warehouse with your current access.'],
            ]);
        }

        $this->validateStopWarehousesForRouting($actor, $stops);
    }

    private function validateTripDestinationWarehouse(User $actor, int $destinationWarehouseId): void
    {
        $routingIds = $this->operationalContext->routingWarehouses($actor)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! in_array($destinationWarehouseId, $routingIds, true)) {
            throw ValidationException::withMessages([
                'destination_warehouse_id' => ['Select an active warehouse in your organization.'],
            ]);
        }
    }

    /**
     * @return array{can_mark_departed: bool, can_undo_depart: bool}
     */
    private function tripDepartureCapabilities(User $user, Trip $trip, int $organizationId): array
    {
        $allowedSource = $this->userMayMutateTripSourceWarehouse($user, $trip);
        $manage = $user->hasPermission('trips.manage');

        $loadedSum = (float) $trip->items->sum(fn ($i) => (float) $i->loaded_qty);
        $deliveredSum = (float) $trip->items->sum(fn ($i) => (float) $i->delivered_qty);

        $hasConfirmations = DeliveryConfirmation::query()
            ->where('organization_id', $organizationId)
            ->whereHas('tripItem', fn ($q) => $q->where('trip_id', $trip->id))
            ->exists();

        $canMark = $manage && $allowedSource
            && in_array($trip->status, ['PLANNED', 'LOADING'], true)
            && $loadedSum > 0.0001;

        $canUndo = $manage && $allowedSource
            && $trip->status === 'DEPARTED'
            && $deliveredSum < 0.0001
            && ! $hasConfirmations;

        return [
            'can_mark_departed' => $canMark,
            'can_undo_depart' => $canUndo,
        ];
    }

    private function userMayMutateTripSourceWarehouse(User $user, Trip $trip): bool
    {
        $ids = $this->operationalContext->organizationWarehouseIds($user);

        return $ids !== [] && in_array((int) $trip->source_warehouse_id, $ids, true);
    }

    private function validateStopWarehousesForRouting(User $actor, array $stops): void
    {
        $routingIds = $this->operationalContext->routingWarehouseIds($actor);
        foreach ($stops as $index => $stop) {
            $wid = isset($stop['warehouse_id']) && $stop['warehouse_id'] !== '' && $stop['warehouse_id'] !== null
                ? (int) $stop['warehouse_id']
                : null;
            if ($wid !== null && ! in_array($wid, $routingIds, true)) {
                throw ValidationException::withMessages([
                    'stops.'.$index.'.warehouse_id' => ['This warehouse cannot be used as a trip stop for your organization.'],
                ]);
            }
        }
    }

    private function vehicleNumberTaken(int $organizationId, string $vehicleNo, ?int $exceptId): bool
    {
        $q = Vehicle::query()
            ->where('organization_id', $organizationId)
            ->whereNull('deleted_at')
            ->where('vehicle_no', $vehicleNo);

        if ($exceptId !== null) {
            $q->where('id', '!=', $exceptId);
        }

        return $q->exists();
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

    private function nextTripNo(int $organizationId): string
    {
        do {
            $no = 'T-'.$this->shortNoSuffix();
        } while (Trip::query()->where('organization_id', $organizationId)->where('trip_no', $no)->exists());

        return $no;
    }
}
