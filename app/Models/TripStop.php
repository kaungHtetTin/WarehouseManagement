<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TripStop extends Model
{
    protected $fillable = [
        'organization_id',
        'trip_id',
        'stop_order',
        'warehouse_id',
        'location_name',
        'city',
        'address',
        'arrival_time',
        'departure_time',
        'status',
    ];

    protected $casts = [
        'arrival_time' => 'datetime',
        'departure_time' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function tripItems(): HasMany
    {
        return $this->hasMany(TripItem::class);
    }
}
