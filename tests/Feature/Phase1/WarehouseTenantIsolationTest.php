<?php

namespace Tests\Feature\Phase1;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WarehouseTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_warehouse_can_be_created_with_only_city(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $this->grantPermission($actingUser, 'warehouses.manage');

        $this->actingAs($actingUser)
            ->post(route('admin.warehouses.store'), [
                'city' => 'Yangon',
            ])
            ->assertRedirect(route('admin.warehouses.index'));

        $this->assertDatabaseHas('warehouses', [
            'organization_id' => $organization->id,
            'city' => 'Yangon',
            'address' => null,
        ]);
    }

    public function test_cannot_update_warehouse_from_other_tenant(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $this->grantPermission($actingUser, 'warehouses.manage');

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Org',
            'code' => 'other-org-'.uniqid(),
            'default_locale' => 'en',
        ]);

        $foreignWarehouse = Warehouse::query()->create([
            'organization_id' => $otherOrganization->id,
            'city' => 'Yangon',
            'address' => 'Foreign street',
        ]);

        $response = $this->actingAs($actingUser)->patch(route('admin.warehouses.update', $foreignWarehouse), [
            'city' => 'Should not apply',
        ]);

        $response->assertNotFound();
    }

    public function test_user_create_writes_audit_log_when_permitted(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $this->grantPermission($actingUser, 'users.manage');

        $response = $this->actingAs($actingUser)->postJson(route('admin.iam.users.store'), [
            'name' => 'New Operator',
            'email' => 'operator@example.test',
            'status' => 'ACTIVE',
            'role_ids' => [],
            'warehouse_ids' => [],
            'warehouse_access_level' => 'VIEW',
            'password' => 'password123',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('audit_logs', [
            'organization_id' => $organization->id,
            'user_id' => $actingUser->id,
            'action' => 'iam.user.create',
        ]);
    }

    private function createTenantUser(): array
    {
        $organization = Organization::query()->create([
            'name' => 'Acme Logistics',
            'code' => 'acme-logistics-'.uniqid(),
            'default_locale' => 'en',
        ]);

        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
            'password' => Hash::make('password'),
        ]);

        return [$organization, $user];
    }

    private function grantPermission(User $user, string $permissionCode): void
    {
        $permission = Permission::query()->firstOrCreate(
            ['code' => $permissionCode],
            [
                'name' => $permissionCode,
                'module' => 'iam',
            ]
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Temp Admin',
            'code' => 'temp_admin_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
