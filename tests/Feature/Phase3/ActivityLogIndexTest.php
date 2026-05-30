<?php

namespace Tests\Feature\Phase3;

use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_log_index_shows_only_current_tenant_logs_and_applies_filters(): void
    {
        $organization = Organization::factory()->create();
        $userA = User::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Alice Admin',
            'status' => 'ACTIVE',
        ]);
        $userB = User::factory()->create([
            'organization_id' => $organization->id,
            'name' => 'Bob Operator',
            'status' => 'ACTIVE',
        ]);
        $viewer = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        $this->grantPermission($viewer, 'activity_logs.view');

        $matching = AuditLog::query()->create([
            'organization_id' => $organization->id,
            'user_id' => $userA->id,
            'action' => 'voucher.create',
            'subject_type' => 'App\\Models\\Voucher',
            'subject_id' => 77,
            'properties' => ['voucher_no' => 'V-1001'],
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subHour(),
        ]);

        AuditLog::query()->create([
            'organization_id' => $organization->id,
            'user_id' => $userB->id,
            'action' => 'trip.create',
            'subject_type' => 'App\\Models\\Trip',
            'subject_id' => 88,
            'properties' => ['trip_no' => 'TRIP-1'],
            'ip_address' => '127.0.0.2',
            'created_at' => now()->subHours(2),
        ]);

        AuditLog::query()->create([
            'organization_id' => Organization::factory()->create()->id,
            'user_id' => null,
            'action' => 'voucher.create',
            'subject_type' => 'App\\Models\\Voucher',
            'subject_id' => 99,
            'properties' => ['voucher_no' => 'FOREIGN'],
            'ip_address' => '10.0.0.1',
            'created_at' => now()->subMinutes(30),
        ]);

        $this->actingAs($viewer)
            ->get(route('admin.activity-logs.index', [
                'action' => 'voucher.create',
                'user_id' => $userA->id,
                'search' => 'V-1001',
            ]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/System/ActivityLogs')
                ->where('filters.action', 'voucher.create')
                ->where('filters.user_id', (string) $userA->id)
                ->where('filters.search', 'V-1001')
                ->has('logs.data', 1)
                ->where('logs.data.0.id', $matching->id)
                ->where('logs.data.0.action', 'voucher.create')
                ->where('logs.data.0.user_name', 'Alice Admin')
                ->etc());
    }

    public function test_activity_log_index_requires_permission(): void
    {
        $organization = Organization::factory()->create();
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        $this->actingAs($user)
            ->get(route('admin.activity-logs.index'))
            ->assertForbidden();
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
            'name' => 'Activity Viewer',
            'code' => 'activity_viewer_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
