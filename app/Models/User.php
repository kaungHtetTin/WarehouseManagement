<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'organization_id',
        'name',
        'email',
        'password',
        'is_platform_admin',
        'status',
        'profile_image_path',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'is_platform_admin' => 'boolean',
    ];

    protected $appends = [
        'profile_image_url',
    ];

    public function getProfileImageUrlAttribute(): ?string
    {
        $path = trim((string) ($this->profile_image_path ?? ''));

        if ($path === '') {
            return null;
        }

        return Storage::disk('public')->url($path);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function directPermissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'user_permissions')->withPivot('effect');
    }

    public function warehouses(): BelongsToMany
    {
        return $this->belongsToMany(Warehouse::class, 'user_warehouse_access')->withPivot('access_level');
    }

    public function canAccessWarehouse(int|Warehouse $warehouse, string $minimumLevel = 'VIEW'): bool
    {
        $warehouseModel = $warehouse instanceof Warehouse
            ? $warehouse
            : Warehouse::query()->find($warehouse);

        if (! $warehouseModel) {
            return false;
        }

        return $warehouseModel->organization_id === $this->organization_id;
    }

    /**
     * @return list<string>
     */
    public function allPermissionCodes(): array
    {
        if ($this->is_platform_admin) {
            return Permission::query()->pluck('code')->all();
        }

        $this->loadMissing(['roles.permissions', 'directPermissions']);

        $codes = collect();
        foreach ($this->roles as $role) {
            $codes = $codes->merge($role->permissions->pluck('code'));
        }

        foreach ($this->directPermissions as $permission) {
            if ($permission->pivot?->effect === 'DENY') {
                $codes = $codes->reject(fn (string $code) => $code === $permission->code);
            } else {
                $codes->push($permission->code);
            }
        }

        return $codes->unique()->values()->all();
    }

    public function hasPermission(string $permissionCode): bool
    {
        if ($this->is_platform_admin) {
            return true;
        }

        if ($this->directPermissions->contains(function (Permission $permission) use ($permissionCode) {
            return $permission->code === $permissionCode && $permission->pivot?->effect === 'DENY';
        })) {
            return false;
        }

        if ($this->directPermissions->contains('code', $permissionCode)) {
            return true;
        }

        return $this->roles()->whereHas('permissions', function ($query) use ($permissionCode) {
            $query->where('code', $permissionCode);
        })->exists();
    }
}
