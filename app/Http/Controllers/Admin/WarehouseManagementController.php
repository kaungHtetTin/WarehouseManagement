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
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $warehouses = $this->scopedWarehouses($user)
            ->orderBy('name')
            ->get(['id', 'organization_id', 'code', 'name', 'city', 'address', 'phone', 'status', 'is_main', 'updated_at']);

        return Inertia::render('Admin/Master/WarehousesIndex', [
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:64',
                Rule::unique('warehouses', 'code')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'name' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:64'],
            'is_main' => ['sometimes', 'boolean'],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE'])],
        ]);

        $warehouse = DB::transaction(function () use ($validated, $organizationId, $actor) {
            if (! empty($validated['is_main'])) {
                Warehouse::query()
                    ->where('organization_id', $organizationId)
                    ->update(['is_main' => false]);
            }

            $warehouse = Warehouse::query()->create([
                'organization_id' => $organizationId,
                'code' => strtoupper($validated['code']),
                'name' => $validated['name'],
                'city' => $validated['city'],
                'address' => $validated['address'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'is_main' => (bool) ($validated['is_main'] ?? false),
                'status' => $validated['status'] ?? 'ACTIVE',
            ]);

            $this->autoAssignWarehouseAccess($warehouse, $actor);

            return $warehouse;
        });

        AuditLogger::record($actor, 'warehouse.create', $warehouse, [
            'code' => $warehouse->code,
            'name' => $warehouse->name,
        ]);

        return Redirect::route('admin.warehouses.index')->with('success', 'Warehouse created successfully.');
    }

    public function update(Request $request, string $warehouse): RedirectResponse
    {
        $actor = $request->user();
        $warehouseModel = $this->resolveTenantWarehouse($actor, $warehouse);

        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('warehouses', 'code')
                    ->ignore($warehouseModel->id)
                    ->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'is_main' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(['ACTIVE', 'INACTIVE'])],
        ]);

        DB::transaction(function () use ($warehouseModel, $validated, $organizationId) {
            if (array_key_exists('is_main', $validated) && $validated['is_main']) {
                Warehouse::query()
                    ->where('organization_id', $organizationId)
                    ->whereKeyNot($warehouseModel->id)
                    ->update(['is_main' => false]);
            }

            if (array_key_exists('code', $validated)) {
                $validated['code'] = strtoupper($validated['code']);
            }

            $warehouseModel->fill($validated);
            $warehouseModel->save();
        });

        $warehouseModel->refresh();

        AuditLogger::record($actor, 'warehouse.update', $warehouseModel, [
            'code' => $warehouseModel->code,
            'name' => $warehouseModel->name,
        ]);

        return Redirect::route('admin.warehouses.index')->with('success', 'Warehouse updated successfully.');
    }

    public function destroy(Request $request, string $warehouse): RedirectResponse
    {
        $actor = $request->user();
        $warehouseModel = $this->resolveTenantWarehouse($actor, $warehouse);

        $snapshot = [
            'code' => $warehouseModel->code,
            'name' => $warehouseModel->name,
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
