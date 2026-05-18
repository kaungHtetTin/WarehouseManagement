<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $warehouses = $this->scopedWarehouses($user)
            ->orderBy('city')
            ->orderBy('id')
            ->get(['id', 'organization_id', 'city', 'address', 'updated_at']);

        return Inertia::render('Admin/Master/WarehousesIndex', [
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'city' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $warehouse = DB::transaction(function () use ($validated, $organizationId, $actor) {
            $warehouse = Warehouse::query()->create([
                'organization_id' => $organizationId,
                'city' => $validated['city'],
                'address' => $validated['address'] ?? null,
            ]);

            $this->autoAssignWarehouseAccess($warehouse, $actor);

            return $warehouse;
        });

        AuditLogger::record($actor, 'warehouse.create', $warehouse, [
            'city' => $warehouse->city,
            'address' => $warehouse->address,
        ]);

        return Redirect::route('admin.warehouses.index')->with('success', 'Warehouse created successfully.');
    }

    public function update(Request $request, string $warehouse): RedirectResponse
    {
        $actor = $request->user();
        $warehouseModel = $this->resolveTenantWarehouse($actor, $warehouse);

        $validated = $request->validate([
            'city' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($warehouseModel, $validated) {
            $warehouseModel->fill($validated);
            $warehouseModel->save();
        });

        $warehouseModel->refresh();

        AuditLogger::record($actor, 'warehouse.update', $warehouseModel, [
            'city' => $warehouseModel->city,
            'address' => $warehouseModel->address,
        ]);

        return Redirect::route('admin.warehouses.index')->with('success', 'Warehouse updated successfully.');
    }

    public function destroy(Request $request, string $warehouse): RedirectResponse
    {
        $actor = $request->user();
        $warehouseModel = $this->resolveTenantWarehouse($actor, $warehouse);

        $snapshot = [
            'city' => $warehouseModel->city,
            'address' => $warehouseModel->address,
        ];

        $warehouseModel->delete();

        AuditLogger::record($actor, 'warehouse.delete', null, $snapshot);

        return Redirect::route('admin.warehouses.index')->with('success', 'Warehouse deleted successfully.');
    }

    private function scopedWarehouses(User $user)
    {
        $query = Warehouse::query()->where('organization_id', $user->organization_id);

        if ($user->bypassesWarehouseScope()) {
            return $query;
        }

        $ids = $user->warehouses()->pluck('warehouses.id');

        return $query->whereIn('id', $ids);
    }

    private function resolveTenantWarehouse(User $user, string $warehouseId): Warehouse
    {
        abort_if($user->organization_id === null, 404);

        return Warehouse::query()
            ->whereKey($warehouseId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }

    private function autoAssignWarehouseAccess(Warehouse $warehouse, User $actor): void
    {
        $organizationId = (int) $actor->organization_id;

        $superAdminIds = User::query()
            ->where('organization_id', $organizationId)
            ->whereHas('roles', fn ($query) => $query->where('code', 'super_admin'))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $userIds = collect($superAdminIds)
            ->push((int) $actor->id)
            ->unique()
            ->values()
            ->all();

        $syncPayload = collect($userIds)
            ->mapWithKeys(fn (int $id) => [$id => ['access_level' => 'MANAGE']])
            ->all();

        $warehouse->usersWithAccess()->syncWithoutDetaching($syncPayload);
    }
}
