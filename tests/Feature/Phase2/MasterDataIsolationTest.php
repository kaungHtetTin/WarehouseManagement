<?php

namespace Tests\Feature\Phase2;

use App\Models\Category;
use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_update_category_from_other_tenant(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'inventory.manage');

        $otherOrganization = Organization::factory()->create();
        $foreignCategory = Category::factory()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Foreign Category',
        ]);

        $response = $this->actingAs($actor)->patch(route('admin.categories.update', $foreignCategory), [
            'name' => 'Tampered',
        ]);

        $response->assertNotFound();
    }

    public function test_product_create_rejects_category_from_other_tenant(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'inventory.manage');

        $otherOrganization = Organization::factory()->create();
        $foreignCategory = Category::factory()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Foreign Category',
        ]);

        $response = $this->actingAs($actor)->post(route('admin.products.store'), [
            'name' => 'Rice',
            'unit' => 'bag',
            'category_id' => $foreignCategory->id,
            'status' => 'ACTIVE',
        ]);

        $response->assertNotFound();
    }

    public function test_cannot_update_merchant_from_other_tenant(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'inventory.manage');

        $otherOrganization = Organization::factory()->create();
        $foreignMerchant = Merchant::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Foreign Merchant',
        ]);

        $response = $this->actingAs($actor)->patch(route('admin.merchants.update', $foreignMerchant), [
            'name' => 'Tampered',
        ]);

        $response->assertNotFound();
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

    private function grantPermission(User $user, string $permissionCode): void
    {
        $permission = Permission::query()->firstOrCreate(
            ['code' => $permissionCode],
            ['name' => $permissionCode, 'module' => 'inventory']
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Inventory Admin',
            'code' => 'inventory_admin_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
