<?php

namespace Tests\Feature\Phase3;

use App\Models\FinanceCategory;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\VoucherAdditionalCostCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryOrganizationScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_organizations_receive_finance_voucher_and_trip_category_defaults(): void
    {
        $organization = Organization::factory()->create();

        $this->assertDatabaseHas('finance_categories', [
            'organization_id' => $organization->id,
            'scope' => 'GENERAL',
            'name' => 'Salary',
        ]);
        $this->assertDatabaseHas('finance_categories', [
            'organization_id' => $organization->id,
            'scope' => 'VOUCHER',
            'name' => 'Voucher Payment',
        ]);
        $this->assertDatabaseHas('finance_categories', [
            'organization_id' => $organization->id,
            'scope' => 'TRIP_COST',
            'name' => 'Fuel',
        ]);
        $this->assertDatabaseHas('voucher_additional_cost_categories', [
            'organization_id' => $organization->id,
            'name' => 'Labor',
        ]);
    }

    public function test_cannot_update_finance_category_from_other_organization(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'finance.manage', 'finance');

        $foreignCategory = FinanceCategory::query()->create([
            'organization_id' => Organization::factory()->create()->id,
            'scope' => 'GENERAL',
            'direction' => 'EXPENSE',
            'name' => 'Foreign Finance Category',
            'status' => 'ACTIVE',
            'sort_order' => 1,
        ]);

        $this->actingAs($actor)
            ->patch(route('admin.finance.categories.update', $foreignCategory), [
                'direction' => 'EXPENSE',
                'name' => 'Tampered',
                'status' => 'ACTIVE',
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('finance_categories', [
            'id' => $foreignCategory->id,
            'name' => 'Foreign Finance Category',
        ]);
        $this->assertDatabaseMissing('finance_categories', [
            'organization_id' => $organization->id,
            'name' => 'Tampered',
        ]);
    }

    public function test_cannot_update_voucher_cost_category_from_other_organization(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'vouchers.manage', 'voucher');

        $foreignCategory = VoucherAdditionalCostCategory::query()->create([
            'organization_id' => Organization::factory()->create()->id,
            'name' => 'Foreign Voucher Cost',
            'status' => 'ACTIVE',
            'sort_order' => 1,
            'is_system' => false,
        ]);

        $this->actingAs($actor)
            ->patch(route('admin.voucher-additional-cost-categories.update', $foreignCategory), [
                'name' => 'Tampered',
                'status' => 'ACTIVE',
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('voucher_additional_cost_categories', [
            'id' => $foreignCategory->id,
            'name' => 'Foreign Voucher Cost',
        ]);
        $this->assertDatabaseMissing('voucher_additional_cost_categories', [
            'organization_id' => $organization->id,
            'name' => 'Tampered',
        ]);
    }

    public function test_cannot_update_trip_cost_category_from_other_organization(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'trips.manage', 'trip');

        $foreignCategory = FinanceCategory::query()->create([
            'organization_id' => Organization::factory()->create()->id,
            'scope' => 'TRIP_COST',
            'direction' => 'EXPENSE',
            'name' => 'Foreign Trip Cost',
            'status' => 'ACTIVE',
            'sort_order' => 1,
        ]);

        $this->actingAs($actor)
            ->patch(route('admin.trip-cost-categories.update', $foreignCategory), [
                'name' => 'Tampered',
                'status' => 'ACTIVE',
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('finance_categories', [
            'id' => $foreignCategory->id,
            'name' => 'Foreign Trip Cost',
        ]);
        $this->assertDatabaseMissing('finance_categories', [
            'organization_id' => $organization->id,
            'name' => 'Tampered',
        ]);
    }

    private function createTenantUser(): array
    {
        $organization = Organization::factory()->create();
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        return [$organization, $user];
    }

    private function grantPermission(User $user, string $permissionCode, string $module): void
    {
        $permission = Permission::query()->firstOrCreate(
            ['code' => $permissionCode],
            ['name' => $permissionCode, 'module' => $module]
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Category Admin',
            'code' => 'category_admin_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
