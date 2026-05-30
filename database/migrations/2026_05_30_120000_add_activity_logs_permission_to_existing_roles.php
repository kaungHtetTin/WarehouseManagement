<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->updateOrInsert(
            ['code' => 'activity_logs.view'],
            [
                'name' => 'View activity logs',
                'module' => 'iam',
            ]
        );

        $permissionId = DB::table('permissions')
            ->where('code', 'activity_logs.view')
            ->value('id');

        if (! $permissionId) {
            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('code', ['super_admin', 'manager'])
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            DB::table('role_permissions')->updateOrInsert([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
            ], []);
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')
            ->where('code', 'activity_logs.view')
            ->value('id');

        if (! $permissionId) {
            return;
        }

        DB::table('role_permissions')
            ->where('permission_id', $permissionId)
            ->delete();

        DB::table('permissions')
            ->where('id', $permissionId)
            ->delete();
    }
};
