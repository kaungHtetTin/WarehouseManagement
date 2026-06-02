<?php

namespace App\Services\Tenant;

use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Organization-wide warehouse access for permitted operations.
 */
final class OperationalWarehouseContext
{
    public function resolveCurrentWarehouseId(User $user, Request $request): ?int
    {
        $first = $this->operatingWarehouses($user)->first();

        return $first ? (int) $first->id : null;
    }

    public function accessibleWarehousesForUi(User $user): Collection
    {
        return $this->organizationWarehouses($user);
    }

    public function organizationWarehouses(User $user): Collection
    {
        return Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->orderBy('city')
            ->orderBy('id')
            ->get(['id', 'city', 'address']);
    }

    /**
     * @return list<int>
     */
    public function accessibleWarehouseIds(User $user): array
    {
        return $this->accessibleWarehousesForUi($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * @return list<int>
     */
    public function organizationWarehouseIds(User $user): array
    {
        return $this->organizationWarehouses($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public function operatingWarehouses(User $user): Collection
    {
        return $this->organizationWarehouses($user);
    }

    public function routingWarehouses(User $user): Collection
    {
        if (! $user->hasPermission('trips.manage')) {
            return collect();
        }

        return $this->organizationWarehouses($user);
    }

    /**
     * @return list<int>
     */
    public function routingWarehouseIds(User $user): array
    {
        return $this->routingWarehouses($user)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }
}
