<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryConfirmation;
use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\Merchant;
use App\Models\Trip;
use App\Models\TripItem;
use App\Models\TripStop;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\Warehouse;
use App\Models\WarehouseFulfillmentInstruction;
use App\Services\Audit\AuditLogger;
use App\Services\Inventory\StockLedgerService;
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
        private StockLedgerService $stockLedger,
        private VoucherOperationalStatusSync $voucherOperationalStatusSync,
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $actor = $request->user();

        $filterWarehouses = $this->operationalContext->assignedWarehousesOnly($actor);

        $allowedSourceIds = $filterWarehouses->pluck('id')->map(fn ($id) => (int) $id)->all();

        $rawFilter = $request->query('source_warehouse_id', 'all');
        $selectedFilter = 'all';
        if ($rawFilter !== null && $rawFilter !== '' && (string) $rawFilter !== 'all') {
            $candidate = (int) $rawFilter;
            if (in_array($candidate, $allowedSourceIds, true)) {
                $selectedFilter = (string) $candidate;
            }
        }

        $trips = Trip::query()
            ->where('organization_id', $organizationId);

        if ($allowedSourceIds === []) {
            $trips->whereRaw('1 = 0');
        } else {
            $trips->whereIn('source_warehouse_id', $allowedSourceIds);
        }

        if ($selectedFilter !== 'all') {
            $trips->where('source_warehouse_id', (int) $selectedFilter);
        }

        $trips = $trips
            ->with([
                'vehicle:id,vehicle_no',
                'sourceWarehouse:id,name,code',
            ])
            ->withCount('stops')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Admin/Operations/TripsIndex', [
            'trips' => $trips,
            'trip_source_filter' => $selectedFilter,
            'trip_filter_warehouses' => $filterWarehouses->values(),
        ]);
    }

    public function create(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;
        abort_if($organizationId === null, 404);

        $user = $request->user();

        $assigned = $this->operationalContext->assignedWarehousesOnly($user)->values();

        return Inertia::render('Admin/Operations/TripCreate', [
            'operatingWarehouses' => $assigned,
            'routingWarehouses' => $assigned,
            'defaultSourceWarehouseId' => $this->operationalContext->resolveCurrentWarehouseId($user, $request),
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

        return response()->json(['results' => $results]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $request->merge([
            'vehicle.capacity_weight' => $request->input('vehicle.capacity_weight') === '' || $request->input('vehicle.capacity_weight') === null
                ? null
                : $request->input('vehicle.capacity_weight'),
            'vehicle.capacity_volume' => $request->input('vehicle.capacity_volume') === '' || $request->input('vehicle.capacity_volume') === null
                ? null
                : $request->input('vehicle.capacity_volume'),
            'vehicle.warehouse_id' => $request->input('vehicle.warehouse_id') === '' || $request->input('vehicle.warehouse_id') === null
                ? null
                : $request->input('vehicle.warehouse_id'),
        ]);

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
            'vehicle.vehicle_type' => ['required', 'string', 'max:64'],
            'vehicle.warehouse_id' => [
                'nullable',
                'integer',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'vehicle.capacity_weight' => ['nullable', 'numeric', 'min:0'],
            'vehicle.capacity_volume' => ['nullable', 'numeric', 'min:0'],
            'source_warehouse_id' => [
                'required',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'driver_name' => ['nullable', 'string', 'max:255'],
            'driver_phone' => ['nullable', 'string', 'max:64'],
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(fn ($q) => $q->where('organization_id', $organizationId)),
            ],
            'stops.*.location_name' => ['nullable', 'string', 'max:255'],
            'stops.*.city' => ['nullable', 'string', 'max:128'],
            'stops.*.address' => ['nullable', 'string', 'max:500'],
        ]);

        $this->validateTripOperationalWarehouses($actor, (int) $validated['source_warehouse_id'], $validated['stops']);

        $vehWh = isset($validated['vehicle']['warehouse_id']) && $validated['vehicle']['warehouse_id'] !== null && $validated['vehicle']['warehouse_id'] !== ''
            ? (int) $validated['vehicle']['warehouse_id']
            : null;
        if ($vehWh !== null) {
            $routingIds = $this->operationalContext->routingWarehouseIds($actor);
            if (! in_array($vehWh, $routingIds, true)) {
                throw ValidationException::withMessages([
                    'vehicle.warehouse_id' => ['Select an active warehouse in your organization.'],
                ]);
            }
        }

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

        try {
            $trip = DB::transaction(function () use ($actor, $organizationId, $validated) {
                $vehicle = $this->resolveVehicleForTrip(
                    $actor,
                    $organizationId,
                    $validated['vehicle'],
                    $validated['vehicle_id'] ?? null
                );

                $trip = Trip::query()->create([
                    'organization_id' => $organizationId,
                    'trip_no' => $this->nextTripNo($organizationId),
                    'vehicle_id' => $vehicle->id,
                    'driver_name' => $validated['driver_name'] ?? null,
                    'driver_phone' => $validated['driver_phone'] ?? null,
                    'source_warehouse_id' => $validated['source_warehouse_id'],
                    'status' => 'PLANNED',
                    'created_by' => $actor->id,
                ]);

                foreach (array_values($validated['stops']) as $order => $row) {
                    TripStop::query()->create([
                        'organization_id' => $organizationId,
                        'trip_id' => $trip->id,
                        'stop_order' => $order + 1,
                        'warehouse_id' => $row['warehouse_id'] ?? null,
                        'location_name' => $row['location_name'] ?? null,
                        'city' => $row['city'] ?? null,
                        'address' => $row['address'] ?? null,
                        'status' => 'PENDING',
                    ]);
                }

                return $trip;
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        AuditLogger::record($actor, 'trip.create', $trip, [
            'trip_no' => $trip->trip_no,
            'stops' => count($validated['stops']),
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
                'vehicle:id,vehicle_no,vehicle_type',
                'sourceWarehouse:id,name,code',
                'creator:id,name',
                'stops' => fn ($q) => $q->orderBy('stop_order')->with('warehouse:id,name,code'),
                'items' => fn ($q) => $q->with([
                    'tripStop:id,stop_order',
                    'deliveryConfirmations' => fn ($q2) => $q2
                        ->with('receivedByUser:id,name')
                        ->orderByDesc('id')
                        ->limit(25),
                    'voucherItem' => fn ($q2) => $q2->with([
                    'product:id,name,unit,default_weight',
                    'voucher:id,voucher_no,total_weight,additional_costs,merchant_id,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone',
                    'voucher.merchant:id,name',
                        'voucher.defaultToWarehouse:id,name,code',
                    ]),
                ]),
            ])
            ->firstOrFail();

        $model->setRelation(
            'items',
            $this->withPendingReceiptQtyForTripItems($model->items, (int) $organizationId)
        );

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

        return Inertia::render('Admin/Operations/TripDetail', [
            'trip' => $model,
            'can_manage_cargo' => $canManageCargo,
            'can_load_cargo' => $canLoadCargo,
            'can_record_delivery' => $canRecordDelivery,
            'can_manage_trip_costs' => $canManageTripCosts,
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
        ]);
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
            'trip_stop_id' => ['nullable', 'integer'],
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
                ->with('voucher:id,status')
                ->lockForUpdate()
                ->first();

            if ($voucherItem === null || ! in_array($voucherItem->voucher->status, self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD, true)) {
                throw ValidationException::withMessages([
                    'voucher_item_id' => ['Select an active voucher line that still has remaining quantity for your organization.'],
                ]);
            }

            if ((int) $voucherItem->from_warehouse_id !== (int) $tripLocked->source_warehouse_id) {
                throw ValidationException::withMessages([
                    'voucher_item_id' => ['This voucher line ships from a different warehouse than this trip\'s source warehouse.'],
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

            $existing = TripItem::query()
                ->where('trip_id', $tripLocked->id)
                ->where('voucher_item_id', $voucherItem->id)
                ->when(
                    $tripStopId !== null,
                    fn ($q) => $q->where('trip_stop_id', $tripStopId),
                    fn ($q) => $q->whereNull('trip_stop_id')
                )
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->loaded_qty = round((float) $existing->loaded_qty + $delta, 3);
                if ($tripStopId !== null) {
                    $existing->trip_stop_id = $tripStopId;
                }
                $existing->save();
                $tripItem = $existing;
            } else {
                $tripItem = TripItem::query()->create([
                    'organization_id' => $organizationId,
                    'trip_id' => $tripLocked->id,
                    'voucher_item_id' => $voucherItem->id,
                    'trip_stop_id' => $tripStopId,
                    'loaded_qty' => $delta,
                    'delivered_qty' => 0,
                    'status' => 'LOADED',
                ]);
            }

            $this->refreshVoucherItemLoadedQty($voucherItem);

            $this->stockLedger->applyTripLoadOutbound($voucherItem, $delta, (int) $tripItem->id, $actor);

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
            'trip_stop_id' => ['nullable', 'integer'],
        ]);

        $voucherId = (int) $validated['voucher_id'];

        try {
            $loadedLines = 0;

            DB::transaction(function () use ($voucherId, $organizationId, $trip, $actor, $validated, &$loadedLines) {
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

                if ((int) $voucher->source_warehouse_id !== (int) $tripLocked->source_warehouse_id) {
                    throw ValidationException::withMessages([
                        'voucher_id' => ['This voucher ships from a different warehouse than this trip\'s source warehouse.'],
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
                        ->when(
                            $tripStopId !== null,
                            fn ($q) => $q->where('trip_stop_id', $tripStopId),
                            fn ($q) => $q->whereNull('trip_stop_id')
                        )
                        ->lockForUpdate()
                        ->first();

                    if ($existing) {
                        $existing->loaded_qty = round((float) $existing->loaded_qty + $remaining, 3);
                        if ($tripStopId !== null) {
                            $existing->trip_stop_id = $tripStopId;
                        }
                        $existing->save();
                        $tripItem = $existing;
                    } else {
                        $tripItem = TripItem::query()->create([
                            'organization_id' => $organizationId,
                            'trip_id' => $tripLocked->id,
                            'voucher_item_id' => $voucherItem->id,
                            'trip_stop_id' => $tripStopId,
                            'loaded_qty' => $remaining,
                            'delivered_qty' => 0,
                            'status' => 'LOADED',
                        ]);
                    }

                    $this->refreshVoucherItemLoadedQty($voucherItem);
                    $this->stockLedger->applyTripLoadOutbound($voucherItem, $remaining, (int) $tripItem->id, $actor);
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
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', $loadedLines === 1 ? 'Loaded 1 voucher line onto trip.' : "Loaded {$loadedLines} voucher lines onto trip.");
    }

    public function syncStops(Request $request, string $trip): RedirectResponse
    {
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
                if ($delta > 0.0001) {
                    $this->stockLedger->applyTripLoadOutbound($voucherItem, $delta, (int) $item->id, $actor);
                } elseif ($delta < -0.0001) {
                    $this->stockLedger->applyTripLoadReturnToWarehouse($voucherItem, abs($delta), (int) $item->id, $actor);
                }

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

                $this->stockLedger->applyTripLoadReturnToWarehouse($voucherItem, $loadedBeforeRemove, $tripItemIdForStock, $actor);

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

                    if ($loadedBeforeRemove > 0.0001) {
                        $this->stockLedger->applyTripLoadReturnToWarehouse($voucherItem, $loadedBeforeRemove, $tripItemIdForStock, $actor);
                    }

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
                'sourceWarehouse:id,name,code',
                'stops' => fn ($q) => $q->orderBy('stop_order')->with('warehouse:id,name,code'),
                'items' => fn ($q) => $q->orderBy('id')->with([
                    'tripStop:id,stop_order',
                    'voucherItem' => fn ($q2) => $q2->with([
                        'product:id,name,unit',
                        'voucher:id,voucher_no,default_to_warehouse_id,default_to_city,default_to_address_line1,default_to_address_line2,default_to_township,default_to_region,default_to_postal_code,default_recipient_name,default_recipient_phone',
                        'voucher.defaultToWarehouse:id,name,code',
                    ]),
                ]),
            ])
            ->firstOrFail();

        $user = $request->user();
        $canMarkPrinted = $user && $user->hasPermission('trips.manage');

        $manifestRows = $tripModel->items->map(function (TripItem $item) {
            $vi = $item->voucherItem;
            if ($vi === null) {
                return null;
            }

            return [
                'voucher_no' => $vi->voucher->voucher_no ?? '—',
                'line_no' => $vi->line_no,
                'product_name' => $vi->product->name ?? '—',
                'loaded_qty' => (string) $item->loaded_qty,
                'delivered_qty' => (string) $item->delivered_qty,
                'unit' => $vi->product->unit ?? $vi->unit ?? '',
                'destination' => $this->formatVoucherItemDestinationForManifest($vi),
                'stop_label' => $item->tripStop !== null ? 'Stop '.$item->tripStop->stop_order : '—',
            ];
        })->filter()->values()->all();

        return view('admin.operations.trips.manifest', [
            'trip' => $tripModel,
            'manifestRows' => $manifestRows,
            'canMarkPrinted' => $canMarkPrinted,
            'adminAppUrl' => rtrim((string) config('app.admin_app_url'), '/'),
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
        $wh = $voucher->defaultToWarehouse;
        if ($wh !== null && (filled($wh->code) || filled($wh->name))) {
            $bits[] = trim(implode(' · ', array_filter([$wh->code, $wh->name])));
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

        $this->stockLedger->applyInboundForDeliveryConfirmation(
            confirmation: $confirmation,
            vi: $voucherItem,
            actor: $actor,
            note: $note,
            receivingWarehouseId: $receivingWarehouseId
        );

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
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $note = isset($validated['note']) && trim((string) $validated['note']) !== '' ? trim((string) $validated['note']) : null;

        try {
            DB::transaction(function () use ($organizationId, $trip, $tripItem, $actor, $note) {
                $tripLocked = Trip::query()
                    ->whereKey($trip)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $item = TripItem::query()
                    ->whereKey($tripItem)
                    ->where('trip_id', $tripLocked->id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $voucherItem = VoucherItem::query()
                    ->whereKey($item->voucher_item_id)
                    ->where('organization_id', $organizationId)
                    ->lockForUpdate()
                    ->firstOrFail();

                $receivingWarehouseId = $this->resolveReceivingWarehouseId($item, $voucherItem, $organizationId);
                if ($receivingWarehouseId === null) {
                    throw ValidationException::withMessages([
                        'note' => ['No receiving warehouse: set a warehouse on the trip stop for this cargo line, or set destination warehouse on the voucher line.'],
                    ]);
                }

                $confirmations = DeliveryConfirmation::query()
                    ->where('organization_id', $organizationId)
                    ->where('trip_item_id', $item->id)
                    ->where('received_qty', '>', 0)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                if ($confirmations->isEmpty()) {
                    throw ValidationException::withMessages([
                        'note' => ['No delivered quantity is available for destination receipt on this cargo line.'],
                    ]);
                }

                $posted = 0;
                $postedQty = 0.0;

                foreach ($confirmations as $confirmation) {
                    $didPost = $this->stockLedger->applyInboundForDeliveryConfirmation(
                        confirmation: $confirmation,
                        vi: $voucherItem,
                        actor: $actor,
                        note: $note,
                        receivingWarehouseId: $receivingWarehouseId
                    );
                    if ($didPost) {
                        $posted++;
                        $postedQty = round($postedQty + (float) $confirmation->received_qty, 3);
                    }
                }

                if ($posted === 0) {
                    throw ValidationException::withMessages([
                        'note' => ['Destination receipt already recorded for all delivered quantities on this cargo line.'],
                    ]);
                }

                AuditLogger::record($actor, 'trip_item.destination_receipt', $item, [
                    'trip_no' => $tripLocked->trip_no,
                    'trip_item_id' => $item->id,
                    'voucher_item_id' => $voucherItem->id,
                    'posted_confirmations' => $posted,
                    'posted_qty' => $postedQty,
                ]);
            });
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->withInput();
        }

        return Redirect::route('admin.trips.show', $trip)
            ->with('success', 'Destination warehouse receipt recorded.');
    }

    private function withPendingReceiptQtyForTripItems(Collection $items, int $organizationId): Collection
    {
        if ($items->isEmpty()) {
            return $items;
        }

        $tripItemIds = $items->pluck('id')->all();
        $confirmations = DeliveryConfirmation::query()
            ->where('organization_id', $organizationId)
            ->whereIn('trip_item_id', $tripItemIds)
            ->where('received_qty', '>', 0)
            ->get(['id', 'trip_item_id', 'received_qty']);

        if ($confirmations->isEmpty()) {
            foreach ($items as $item) {
                $item->pending_receipt_qty = '0.000';
            }
            return $items;
        }

        $postedConfirmationIds = \App\Models\StockMovement::query()
            ->where('organization_id', $organizationId)
            ->where('movement_type', 'TRANSFER_IN')
            ->where('ref_type', 'DELIVERY_CONFIRMATION')
            ->whereIn('ref_id', $confirmations->pluck('id')->all())
            ->pluck('ref_id')
            ->map(fn ($id) => (int) $id)
            ->flip();

        $pendingByTripItem = [];
        foreach ($confirmations as $c) {
            if (isset($postedConfirmationIds[(int) $c->id])) {
                continue;
            }
            $tid = (int) $c->trip_item_id;
            $pendingByTripItem[$tid] = round(($pendingByTripItem[$tid] ?? 0) + (float) $c->received_qty, 3);
        }

        foreach ($items as $item) {
            $pending = (float) ($pendingByTripItem[(int) $item->id] ?? 0);
            $item->pending_receipt_qty = number_format(max(0, $pending), 3, '.', '');
        }

        return $items;
    }

    /**
     * @return list<array{id:int,voucher_no:string,line_no:int,product_name:string,unit:string,qty:string,remaining_qty:string}>
     */
    private function loadableVoucherItems(Trip $trip, int $organizationId): array
    {
        $items = VoucherItem::query()
            ->where('organization_id', $organizationId)
            ->where('from_warehouse_id', $trip->source_warehouse_id)
            ->whereHas('voucher', fn ($q) => $q->whereIn('status', self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD))
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
     * @return list<array{id:int,voucher_no:string,merchant_name:string|null,remaining_qty:string,lines:int}>
     */
    private function loadableVouchers(Trip $trip, int $organizationId): array
    {
        $items = VoucherItem::query()
            ->where('organization_id', $organizationId)
            ->where('from_warehouse_id', $trip->source_warehouse_id)
            ->whereHas('voucher', fn ($q) => $q->whereIn('status', self::VOUCHER_STATUSES_ALLOWING_TRIP_LOAD))
            ->with([
                'voucher:id,voucher_no,merchant_id',
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
                    'remaining' => 0.0,
                    'lines' => 0,
                ];
            }
            $byVoucher[$vid]['remaining'] = (float) $byVoucher[$vid]['remaining'] + (float) $remaining;
            $byVoucher[$vid]['lines'] = (int) $byVoucher[$vid]['lines'] + 1;
        }

        $out = array_values($byVoucher);
        usort($out, fn ($a, $b) => strcmp($b['voucher_no'], $a['voucher_no']));

        return array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'voucher_no' => (string) $row['voucher_no'],
                'merchant_name' => isset($row['merchant_name']) ? (string) $row['merchant_name'] : null,
                'remaining_qty' => number_format(max(0, (float) $row['remaining']), 3, '.', ''),
                'lines' => (int) $row['lines'],
            ];
        }, $out);
    }

    /**
     * @param  array<string, mixed>  $vehiclePayload
     */
    private function resolveVehicleForTrip(User $actor, int $organizationId, array $vehiclePayload, ?int $vehicleId): Vehicle
    {
        $vehicleNo = strtoupper(trim((string) $vehiclePayload['vehicle_no']));
        $warehouseId = isset($vehiclePayload['warehouse_id']) && $vehiclePayload['warehouse_id'] !== null
            ? (int) $vehiclePayload['warehouse_id']
            : null;

        $capW = array_key_exists('capacity_weight', $vehiclePayload)
            && $vehiclePayload['capacity_weight'] !== null
            && $vehiclePayload['capacity_weight'] !== ''
            ? round((float) $vehiclePayload['capacity_weight'], 3)
            : null;
        $capV = array_key_exists('capacity_volume', $vehiclePayload)
            && $vehiclePayload['capacity_volume'] !== null
            && $vehiclePayload['capacity_volume'] !== ''
            ? round((float) $vehiclePayload['capacity_volume'], 3)
            : null;

        $type = trim((string) $vehiclePayload['vehicle_type']);

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
                'vehicle_type' => $type,
                'warehouse_id' => $warehouseId,
                'capacity_weight' => $capW,
                'capacity_volume' => $capV,
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
                'vehicle_type' => $type,
                'warehouse_id' => $warehouseId,
                'capacity_weight' => $capW,
                'capacity_volume' => $capV,
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
            'warehouse_id' => $warehouseId,
            'vehicle_no' => $vehicleNo,
            'vehicle_type' => $type,
            'capacity_weight' => $capW,
            'capacity_volume' => $capV,
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
        $ids = $this->operationalContext->assignedWarehouseIds($user);

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
