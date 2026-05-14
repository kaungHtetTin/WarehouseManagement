<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VoucherItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'voucher_id',
        'line_no',
        'product_id',
        'description',
        'from_warehouse_id',
        'qty',
        'loaded_qty',
        'delivered_qty',
        'unit',
        'freight_rate',
        'freight_amount',
        'is_fragile',
    ];

    protected $casts = [
        'qty' => 'decimal:3',
        'loaded_qty' => 'decimal:3',
        'delivered_qty' => 'decimal:3',
        'freight_rate' => 'decimal:2',
        'freight_amount' => 'decimal:2',
        'is_fragile' => 'boolean',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function fromWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function tripItems(): HasMany
    {
        return $this->hasMany(TripItem::class);
    }

    public function fulfillmentInstructions(): HasMany
    {
        return $this->hasMany(WarehouseFulfillmentInstruction::class);
    }
}
