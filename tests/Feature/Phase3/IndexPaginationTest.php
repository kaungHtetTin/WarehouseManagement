<?php

namespace Tests\Feature\Phase3;

use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Voucher;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IndexPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_requested_indexes_return_paginated_rows(): void
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create(['organization_id' => $organization->id]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $user->warehouses()->attach($warehouse->id, ['access_level' => 'VIEW']);
        $this->grantPermissions($user, ['inventory.view', 'trips.view', 'finance.view', 'vouchers.view']);

        $vehicle = Vehicle::query()->create([
            'organization_id' => $organization->id,
            'warehouse_id' => $warehouse->id,
            'vehicle_no' => 'PAGINATION-VEHICLE',
            'vehicle_type' => 'GENERAL',
        ]);
        $category = FinanceCategory::query()->create([
            'organization_id' => $organization->id,
            'scope' => 'GENERAL',
            'direction' => 'BOTH',
            'name' => 'Pagination category',
            'status' => 'ACTIVE',
        ]);

        foreach (range(1, 12) as $index) {
            Merchant::query()->create([
                'organization_id' => $organization->id,
                'name' => sprintf('Merchant %02d', $index),
            ]);
            Trip::query()->create([
                'organization_id' => $organization->id,
                'trip_no' => sprintf('TRIP-PAGE-%02d', $index),
                'vehicle_id' => $vehicle->id,
                'source_warehouse_id' => $warehouse->id,
                'status' => 'PLANNED',
                'created_by' => $user->id,
            ]);
            FinanceEntry::query()->create([
                'organization_id' => $organization->id,
                'scope' => 'GENERAL',
                'direction' => 'INCOME',
                'category_id' => $category->id,
                'amount' => 100,
                'currency' => 'MMK',
                'occurred_at' => now(),
                'source' => 'MANUAL',
                'created_by' => $user->id,
            ]);
            Voucher::query()->create([
                'organization_id' => $organization->id,
                'voucher_no' => sprintf('V-PAGE-%02d', $index),
                'voucher_date' => now()->toDateString(),
                'source_warehouse_id' => $warehouse->id,
                'status' => 'CONFIRMED',
                'payment_status' => 'UNPAID',
                'total_qty' => 1,
                'created_by' => $user->id,
                'default_to_warehouse_id' => $warehouse->id,
                'default_to_city' => $warehouse->city,
                'default_to_address_line1' => $warehouse->address,
            ]);
        }

        $this->actingAs($user)
            ->get(route('admin.vouchers.index', ['per_page' => 10, 'page' => 2]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/VouchersIndex')
                ->has('vouchers.data', 2)
                ->where('vouchers.current_page', 2)
                ->where('vouchers.per_page', 10)
                ->where('vouchers.total', 12)
                ->etc());

        $this->actingAs($user)
            ->get(route('admin.trips.index', ['status' => 'PLANNED', 'per_page' => 10, 'page' => 2]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/TripsIndex')
                ->has('trips.data', 2)
                ->where('trips.current_page', 2)
                ->where('trips.per_page', 10)
                ->where('trips.total', 12)
                ->where('trip_status_filter', 'PLANNED')
                ->etc());

        $this->actingAs($user)
            ->get(route('admin.finance.ledger.index', ['per_page' => 10, 'page' => 2]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Finance/FinanceLedger')
                ->has('entries.data', 2)
                ->where('entries.current_page', 2)
                ->where('entries.per_page', 10)
                ->where('entries.total', 12)
                ->etc());

        $this->actingAs($user)
            ->get(route('admin.merchants.index', ['per_page' => 10, 'page' => 2]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Master/MerchantsIndex')
                ->has('merchants.data', 2)
                ->where('merchants.current_page', 2)
                ->where('merchants.per_page', 10)
                ->where('merchants.total', 12)
                ->etc());
    }

    /**
     * @param  list<string>  $codes
     */
    private function grantPermissions(User $user, array $codes): void
    {
        $permissionIds = [];
        foreach ($codes as $code) {
            $permissionIds[] = Permission::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'module' => 'test']
            )->id;
        }

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Pagination Viewer',
            'code' => 'pagination_viewer',
            'is_system_role' => false,
        ]);
        $role->permissions()->sync($permissionIds);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
