<?php

namespace Tests\Feature\Phase1;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IamAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_update_requires_roles_manage_permission(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $role = Role::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Operator',
            'code' => 'operator',
            'is_system_role' => false,
        ]);

        $response = $this->actingAs($actingUser)->patchJson(route('admin.iam.roles.update', $role), [
            'name' => 'Updated Role',
        ]);

        $response->assertForbidden();
    }

    public function test_role_update_succeeds_with_permission_inside_same_tenant(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $this->grantPermission($actingUser, 'roles.manage');

        $role = Role::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Clerk',
            'code' => 'clerk',
            'is_system_role' => false,
        ]);

        $response = $this->actingAs($actingUser)->patchJson(route('admin.iam.roles.update', $role), [
            'name' => 'Senior Clerk',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Senior Clerk');
    }

    public function test_role_update_is_blocked_across_tenants(): void
    {
        [$organization, $actingUser] = $this->createTenantUser();
        $this->grantPermission($actingUser, 'roles.manage');

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Org',
            'code' => 'other-org-2',
            'default_locale' => 'en',
        ]);

        $otherRole = Role::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Role',
            'code' => 'other_role',
            'is_system_role' => false,
        ]);

        $response = $this->actingAs($actingUser)->patchJson(route('admin.iam.roles.update', $otherRole), [
            'name' => 'Attempted Update',
        ]);

        $response->assertNotFound();
    }

    private function createTenantUser(): array
    {
        $organization = Organization::query()->create([
            'name' => 'Acme Logistics',
            'code' => 'acme-logistics',
            'default_locale' => 'en',
        ]);

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

