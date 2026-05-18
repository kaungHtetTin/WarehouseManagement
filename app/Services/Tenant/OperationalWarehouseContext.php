<?php

namespace App\Services\Tenant;

use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * IAM-assigned warehouses vs trip load validation ({@see operatingWarehouses}).
 */
final class OperationalWarehouseContext
{
    public function resolveCurrentWarehouseId(User $user, Request $request): ?int
    {
        $first = $this->operatingWarehouses($user)->first();

        return $first ? (int) $first->id : null;
    }

    /**
     * Active warehouses assigned to the user (any access level), or all active org warehouses if scope bypassed.
     * Use for filter dropdowns and list scoping — not for trip load-from validation (see {@see operatingWarehouses}).
     */
    public function accessibleWarehousesForUi(User $user): Collection
    {
        $query = Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->orderBy('city')
            ->orderBy('id');

        if ($user->bypassesWarehouseScope()) {
            return $query->get(['id', 'city', 'address']);
        }

        $ids = $user->warehouses()->pluck('warehouses.id');
        if ($ids->isEmpty()) {
            return collect();
        }

        return $query->whereIn('id', $ids)->get(['id', 'city', 'address']);
    }

    /**
     * @return list<int>
     */
    public function accessibleWarehouseIds(User $user): array
    {
        return $this->accessibleWarehousesForUi($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * Active warehouses explicitly assigned to the user on IAM (any access level).
     * Ignores org-wide scope bypass — same rule as the stock page filter.
     */
    public function assignedWarehousesOnly(User $user): Collection
    {
        $ids = $user->warehouses()->pluck('warehouses.id');
        if ($ids->isEmpty()) {
            return collect();
        }

        return Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->whereIn('id', $ids)
            ->orderBy('city')
            ->orderBy('id')
            ->get(['id', 'city', 'address']);
    }

    /**
     * @return list<int>
     */
    public function assignedWarehouseIds(User $user): array
    {
        return $this->assignedWarehousesOnly($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * Warehouses the user may load / ship from (trip source validation).
     */
    public function operatingWarehouses(User $user): Collection
    {
        $query = Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->orderBy('city')
            ->orderBy('id');

        if ($user->bypassesWarehouseScope()) {
            return $query->get(['id', 'city', 'address']);
        }

        return $user->warehouses()
            ->wherePivotIn('access_level', ['OPERATE', 'MANAGE'])
            ->orderBy('warehouses.city')
            ->orderBy('warehouses.id')
            ->get(['warehouses.id', 'warehouses.city', 'warehouses.address']);
    }

    /**
     * Trip stops / vehicle home: IAM-assigned warehouses only (same as stock filter).
     */
    public function routingWarehouses(User $user): Collection
    {
        if (! $user->hasPermission('trips.manage')) {
            return collect();
        }

        return $this->assignedWarehousesOnly($user);
    }

    public function routingWarehouseIds(User $user): array
    {
        return $this->routingWarehouses($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }
}
