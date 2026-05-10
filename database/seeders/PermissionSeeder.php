<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            ['code' => 'users.manage', 'name' => 'Manage users', 'module' => 'iam'],
            ['code' => 'roles.manage', 'name' => 'Manage roles and permissions', 'module' => 'iam'],
            ['code' => 'warehouses.view', 'name' => 'View warehouses', 'module' => 'warehouse'],
            ['code' => 'warehouses.manage', 'name' => 'Manage warehouses', 'module' => 'warehouse'],
            ['code' => 'inventory.view', 'name' => 'View inventory', 'module' => 'inventory'],
            ['code' => 'inventory.manage', 'name' => 'Manage inventory', 'module' => 'inventory'],
            ['code' => 'vouchers.view', 'name' => 'View vouchers', 'module' => 'voucher'],
            ['code' => 'vouchers.manage', 'name' => 'Manage vouchers', 'module' => 'voucher'],
            ['code' => 'trips.view', 'name' => 'View trips', 'module' => 'trip'],
            ['code' => 'trips.manage', 'name' => 'Manage trips', 'module' => 'trip'],
            ['code' => 'payments.manage', 'name' => 'Manage payment status', 'module' => 'payment'],
            ['code' => 'billing.view', 'name' => 'View billing', 'module' => 'billing'],
            ['code' => 'billing.manage', 'name' => 'Manage billing', 'module' => 'billing'],
            ['code' => 'public_page.manage', 'name' => 'Manage public organization page', 'module' => 'public_page'],
        ];

        foreach ($permissions as $permission) {
            Permission::query()->updateOrCreate(
                ['code' => $permission['code']],
                $permission
            );
        }
    }
}

