<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Warehouse;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VehicleManagementController extends Controller
{
    public function __construct(
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;

        $vehicles = Vehicle::query()
            ->where('organization_id', $organizationId)
            ->with('warehouse:id,name,code')
            ->orderBy('vehicle_no')
            ->get([
                'id',
                'organization_id',
                'warehouse_id',
                'vehicle_no',
                'vehicle_type',
                'capacity_weight',
                'capacity_volume',
                'status',
                'updated_at',
            ]);

        $warehouses = $this->operationalContext->accessibleWarehousesForUi($request->user());

        return Inertia::render('Admin/Master/VehiclesIndex', [
            'vehicles' => $vehicles,
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $this->mergeOptionalNumericFields($request);

        $validated = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'vehicle_no' => [
                'required',
                'string',
                'max:64',
                Rule::unique('vehicles', 'vehicle_no')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'vehicle_type' => ['required', 'string', 'max:64'],
            'capacity_weight' => ['nullable', 'numeric', 'min:0'],
            'capacity_volume' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])],
        ]);

        $warehouseId = $this->resolveTenantWarehouseId($actor, $validated['warehouse_id'] ?? null);

        $vehicle = Vehicle::query()->create([
            'organization_id' => $organizationId,
            'warehouse_id' => $warehouseId,
            'vehicle_no' => strtoupper(trim($validated['vehicle_no'])),
            'vehicle_type' => $validated['vehicle_type'],
            'capacity_weight' => $validated['capacity_weight'] ?? null,
            'capacity_volume' => $validated['capacity_volume'] ?? null,
            'status' => $validated['status'] ?? 'ACTIVE',
        ]);

        AuditLogger::record($actor, 'vehicle.create', $vehicle, ['vehicle_no' => $vehicle->vehicle_no]);

        return Redirect::route('admin.vehicles.index')->with('success', 'Vehicle created successfully.');
    }

    public function update(Request $request, string $vehicle): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        $vehicleModel = $this->resolveTenantVehicle($actor, $vehicle);

        $this->mergeOptionalNumericFields($request);

        $validated = $request->validate([
            'warehouse_id' => ['sometimes', 'nullable', 'integer'],
            'vehicle_no' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('vehicles', 'vehicle_no')
                    ->ignore($vehicleModel->id)
                    ->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'vehicle_type' => ['sometimes', 'required', 'string', 'max:64'],
            'capacity_weight' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'capacity_volume' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])],
        ]);

        if (array_key_exists('warehouse_id', $validated)) {
            $validated['warehouse_id'] = $this->resolveTenantWarehouseId($actor, $validated['warehouse_id']);
        }

        if (array_key_exists('vehicle_no', $validated)) {
            $validated['vehicle_no'] = strtoupper(trim($validated['vehicle_no']));
        }

        $vehicleModel->fill($validated);
        $vehicleModel->save();

        AuditLogger::record($actor, 'vehicle.update', $vehicleModel, ['vehicle_no' => $vehicleModel->vehicle_no]);

        return Redirect::route('admin.vehicles.index')->with('success', 'Vehicle updated successfully.');
    }

    public function destroy(Request $request, string $vehicle): RedirectResponse
    {
        $actor = $request->user();
        $vehicleModel = $this->resolveTenantVehicle($actor, $vehicle);

        $snapshot = ['vehicle_no' => $vehicleModel->vehicle_no];
        $vehicleModel->delete();

        AuditLogger::record($actor, 'vehicle.delete', null, $snapshot);

        return Redirect::route('admin.vehicles.index')->with('success', 'Vehicle deleted successfully.');
    }

    private function resolveTenantVehicle(User $user, string $vehicleId): Vehicle
    {
        abort_if($user->organization_id === null, 404);

        return Vehicle::query()
            ->whereKey($vehicleId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }

    private function resolveTenantWarehouseId(User $user, ?int $warehouseId): ?int
    {
        if ($warehouseId === null) {
            return null;
        }

        $warehouse = Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->whereKey($warehouseId)
            ->first();

        abort_if($warehouse === null, 404);
        abort_unless($user->canAccessWarehouse($warehouse, 'VIEW'), 403);

        return $warehouseId;
    }

    private function mergeOptionalNumericFields(Request $request): void
    {
        foreach (['capacity_weight', 'capacity_volume'] as $field) {
            if ($request->has($field)) {
                $v = $request->input($field);
                if ($v === '' || (is_string($v) && trim($v) === '')) {
                    $request->merge([$field => null]);
                }
            }
        }
    }
}
