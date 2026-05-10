<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;

        $roles = $this->tenantRoles($organizationId);
        $permissions = Permission::query()
            ->select(['id', 'code', 'name', 'module'])
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Iam/RolesIndex', [
            'roles' => $roles,
            'permissions' => $permissions,
        ]);
    }

    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $organizationId = $request->user()->organization_id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('roles', 'code')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer'],
        ]);

        $role = Role::query()->create([
            'organization_id' => $organizationId,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? Str::slug($validated['name'], '_'),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync($this->scopedPermissionIds($validated['permission_ids'] ?? []));

        AuditLogger::record($request->user(), 'iam.role.create', $role, [
            'code' => $role->code,
            'name' => $role->name,
        ]);

        $responseData = [
            'message' => 'Role created successfully.',
            'data' => $role->load('permissions:id,code,name,module'),
        ];

        if ($request->expectsJson()) {
            return response()->json($responseData, 201);
        }

        return Redirect::route('admin.iam.roles.index')->with('success', $responseData['message']);
    }

    public function update(Request $request, Role $role): JsonResponse|RedirectResponse
    {
        $organizationId = $request->user()->organization_id;
        $this->ensureSameOrganization($role, $organizationId);

        if ($role->is_system_role) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'System role cannot be modified.'], 422);
            }

            return Redirect::route('admin.iam.roles.index')->with('error', 'System role cannot be modified.');
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'code')
                    ->ignore($role->id)
                    ->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'permission_ids' => ['sometimes', 'array'],
            'permission_ids.*' => ['integer'],
        ]);

        $role->fill($validated);
        $role->save();

        if (array_key_exists('permission_ids', $validated)) {
            $role->permissions()->sync($this->scopedPermissionIds($validated['permission_ids']));
        }

        AuditLogger::record($request->user(), 'iam.role.update', $role, [
            'code' => $role->code,
            'name' => $role->name,
        ]);

        $responseData = [
            'message' => 'Role updated successfully.',
            'data' => $role->load('permissions:id,code,name,module'),
        ];

        if ($request->expectsJson()) {
            return response()->json($responseData);
        }

        return Redirect::route('admin.iam.roles.index')->with('success', $responseData['message']);
    }

    public function destroy(Request $request, Role $role): JsonResponse|RedirectResponse
    {
        $organizationId = $request->user()->organization_id;
        $this->ensureSameOrganization($role, $organizationId);

        if ($role->is_system_role) {
            return response()->json(['message' => 'System role cannot be deleted.'], 422);
        }

        AuditLogger::record($request->user(), 'iam.role.delete', null, [
            'deleted_role_id' => $role->id,
            'code' => $role->code,
        ]);

        $role->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Role deleted successfully.']);
        }

        return Redirect::route('admin.iam.roles.index')->with('success', 'Role deleted successfully.');
    }

    private function scopedPermissionIds(array $permissionIds): array
    {
        return Permission::query()
            ->whereIn('id', $permissionIds)
            ->pluck('id')
            ->all();
    }

    private function ensureSameOrganization(Role $role, ?int $organizationId): void
    {
        abort_if($organizationId === null || $role->organization_id !== $organizationId, 404);
    }

    private function tenantRoles(?int $organizationId)
    {
        return Role::query()
            ->where('organization_id', $organizationId)
            ->with('permissions:id,code,name,module')
            ->latest('id')
            ->get();
    }
}

