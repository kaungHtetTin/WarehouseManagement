<?php

namespace App\Services\Tenant;

use App\Models\Permission;
use App\Models\Role;

class TenantRoleBootstrapper
{
    /**
     * Create default tenant roles and attach mapped permissions.
     */
    public function bootstrap(int $organizationId): array
    {
        $permissionMap = Permission::query()->pluck('id', 'code');

        $definitions = [
            'super_admin' => [
                'name' => 'Super Admin',
                'is_system_role' => true,
                'permissions' => $permissionMap->keys()->all(),
            ],
            'manager' => [
                'name' => 'Manager',
                'is_system_role' => true,
                'permissions' => [
                    'warehouses.view',
                    'warehouses.manage',
                    'inventory.view',
                    'inventory.manage',
                    'vouchers.view',
                    'vouchers.manage',
                    'trips.view',
                    'trips.manage',
                    'payments.manage',
                    'finance.view',
                    'finance.manage',
                ],
            ],
            'clerk' => [
                'name' => 'Clerk',
                'is_system_role' => true,
                'permissions' => [
                    'warehouses.view',
                    'inventory.view',
                    'inventory.manage',
                    'vouchers.view',
                    'vouchers.manage',
                    'trips.view',
                    'trips.manage',
                ],
            ],
            'finance' => [
                'name' => 'Finance',
                'is_system_role' => true,
                'permissions' => [
                    'warehouses.view',
                    'vouchers.view',
                    'trips.view',
                    'payments.manage',
                    'finance.view',
                    'finance.manage',
                ],
            ],
            'viewer' => [
                'name' => 'Viewer',
                'is_system_role' => true,
                'permissions' => [
                    'warehouses.view',
                    'inventory.view',
                    'vouchers.view',
                    'trips.view',
                    'finance.view',
                ],
            ],
        ];

        $roles = [];

        foreach ($definitions as $code => $definition) {
            $role = Role::query()->updateOrCreate(
                [
                    'organization_id' => $organizationId,
                    'code' => $code,
                ],
                [
                    'name' => $definition['name'],
                    'is_system_role' => $definition['is_system_role'],
                ]
            );

            $permissionIds = collect($definition['permissions'])
                ->map(fn (string $permissionCode) => $permissionMap->get($permissionCode))
                ->filter()
                ->values()
                ->all();

            $role->permissions()->sync($permissionIds);
            $roles[$code] = $role;
        }

        return $roles;
    }
}
