<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseFulfillmentInstruction extends Model
{
    protected $fillable = [
        'organization_id',
        'warehouse_id',
        'trip_item_id',
        'voucher_item_id',
        'merchant_id',
        'qty_received',
        'qty_dispatched',
        'status',
        'next_action_type',
        'next_warehouse_id',
        'note',
        'last_updated_by',
    ];

    protected $casts = [
        'qty_received' => 'decimal:3',
        'qty_dispatched' => 'decimal:3',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function nextWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'next_warehouse_id');
    }

    public function tripItem(): BelongsTo
    {
        return $this->belongsTo(TripItem::class);
    }

    public function voucherItem(): BelongsTo
    {
        return $this->belongsTo(VoucherItem::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}

