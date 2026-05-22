<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $users = $this->tenantUsers($user->organization_id);
        $roles = Role::query()
            ->where('organization_id', $user->organization_id)
            ->select(['id', 'name', 'code'])
            ->orderBy('name')
            ->get();
        $warehouses = Warehouse::query()
            ->where('organization_id', $user->organization_id)
            ->orderBy('city')
            ->orderBy('id')
            ->get(['id', 'city', 'address']);

        return Inertia::render('Admin/Iam/UsersIndex', [
            'users' => $users,
            'roles' => $roles,
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE'])],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer'],
            'password' => ['nullable', 'string', 'min:8'],
            'warehouse_ids' => ['nullable', 'array'],
            'warehouse_ids.*' => ['integer'],
            'warehouse_access_level' => ['nullable', Rule::in(['VIEW', 'OPERATE', 'MANAGE'])],
        ]);

        $newUser = User::query()->create([
            'organization_id' => $organizationId,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password'] ?? Str::random(12)),
            'status' => $validated['status'] ?? 'ACTIVE',
        ]);

        $this->syncTenantRoles($newUser, $validated['role_ids'] ?? [], $organizationId);
        $this->syncWarehouseAccess(
            $newUser,
            $validated['warehouse_ids'] ?? [],
            $validated['warehouse_access_level'] ?? 'VIEW',
            $organizationId
        );

        AuditLogger::record($actor, 'iam.user.create', $newUser, [
            'email' => $newUser->email,
        ]);

        $responseData = [
            'message' => 'User created successfully.',
            'data' => $newUser->load('roles:id,name,code'),
        ];

        if ($request->expectsJson()) {
            return response()->json($responseData, 201);
        }

        return Redirect::route('admin.iam.users.index')->with('success', $responseData['message']);
    }

    public function update(Request $request, User $user): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        $this->ensureSameOrganization($user, $organizationId);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')
                    ->ignore($user->id)
                    ->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'status' => ['sometimes', Rule::in(['ACTIVE', 'INACTIVE'])],
            'role_ids' => ['sometimes', 'array'],
            'role_ids.*' => ['integer'],
            'warehouse_ids' => ['sometimes', 'array'],
            'warehouse_ids.*' => ['integer'],
            'warehouse_access_level' => ['sometimes', Rule::in(['VIEW', 'OPERATE', 'MANAGE'])],
        ]);

        if (array_key_exists('status', $validated) && $user->id === $actor->id && $validated['status'] === 'INACTIVE') {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        $user->fill($validated);
        $user->save();

        if (array_key_exists('role_ids', $validated)) {
            $this->syncTenantRoles($user, $validated['role_ids'], $organizationId);
        }

        if (array_key_exists('warehouse_ids', $validated)) {
            $this->syncWarehouseAccess(
                $user,
                $validated['warehouse_ids'],
                $validated['warehouse_access_level'] ?? 'VIEW',
                $organizationId
            );
        }

        AuditLogger::record($actor, 'iam.user.update', $user, [
            'email' => $user->email,
        ]);

        $responseData = [
            'message' => 'User updated successfully.',
            'data' => $user->load('roles:id,name,code'),
        ];

        if ($request->expectsJson()) {
            return response()->json($responseData);
        }

        return Redirect::route('admin.iam.users.index')->with('success', $responseData['message']);
    }

    public function destroy(Request $request, User $user): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $this->ensureSameOrganization($user, $actor->organization_id);

        if ($user->id === $actor->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        AuditLogger::record($actor, 'iam.user.delete', null, [
            'deleted_user_id' => $user->id,
            'email' => $user->email,
        ]);

        $user->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'User deleted successfully.']);
        }

        return Redirect::route('admin.iam.users.index')->with('success', 'User deleted successfully.');
    }

    private function syncTenantRoles(User $user, array $roleIds, int $organizationId): void
    {
        $scopedRoleIds = Role::query()
            ->where('organization_id', $organizationId)
            ->whereIn('id', $roleIds)
            ->pluck('id')
            ->all();

        $user->roles()->sync($scopedRoleIds);
    }

    private function ensureSameOrganization(User $user, ?int $organizationId): void
    {
        abort_if($organizationId === null || $user->organization_id !== $organizationId, 404);
    }

    private function tenantUsers(?int $organizationId)
    {
        return User::query()
            ->where('organization_id', $organizationId)
            ->with([
                'roles:id,name,code',
                'warehouses:id,city,address',
            ])
            ->select(['id', 'organization_id', 'name', 'email', 'status', 'last_login_at', 'created_at'])
            ->latest('id')
            ->get();
    }

    private function syncWarehouseAccess(User $user, array $warehouseIds, string $accessLevel, int $organizationId): void
    {
        $validIds = Warehouse::query()
            ->where('organization_id', $organizationId)
            ->whereIn('id', $warehouseIds)
            ->pluck('id')
            ->all();

        $syncPayload = collect($validIds)->mapWithKeys(fn (int $id) => [$id => ['access_level' => $accessLevel]])->all();

        $user->warehouses()->sync($syncPayload);
    }
}
