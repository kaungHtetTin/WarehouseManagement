<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TripItem extends Model
{
    protected $fillable = [
        'organization_id',
        'trip_id',
        'voucher_item_id',
        'trip_stop_id',
        'loaded_qty',
        'delivered_qty',
        'status',
    ];

    protected $casts = [
        'loaded_qty' => 'decimal:3',
        'delivered_qty' => 'decimal:3',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function voucherItem(): BelongsTo
    {
        return $this->belongsTo(VoucherItem::class);
    }

    public function tripStop(): BelongsTo
    {
        return $this->belongsTo(TripStop::class);
    }

    public function deliveryConfirmations(): HasMany
    {
        return $this->hasMany(DeliveryConfirmation::class)->orderByDesc('id');
    }

}
