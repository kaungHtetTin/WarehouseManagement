<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'city',
        'address',
    ];

    protected $appends = [
        'display_name',
    ];

    public function getDisplayNameAttribute(): string
    {
        $city = trim((string) ($this->city ?? ''));
        $address = trim((string) ($this->address ?? ''));

        if ($city === '') {
            return $address;
        }
        if ($address === '') {
            return $city;
        }

        return $city.' - '.$address;
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function usersWithAccess(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_warehouse_access')->withPivot('access_level');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }
}
