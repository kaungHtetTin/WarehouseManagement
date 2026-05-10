<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryConfirmation extends Model
{
    protected $fillable = [
        'organization_id',
        'trip_item_id',
        'received_qty',
        'received_by_user_id',
        'received_by_name',
        'received_at',
        'note',
        'delivery_status',
    ];

    protected $casts = [
        'received_qty' => 'decimal:3',
        'received_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function tripItem(): BelongsTo
    {
        return $this->belongsTo(TripItem::class);
    }

    public function receivedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_user_id');
    }
}
