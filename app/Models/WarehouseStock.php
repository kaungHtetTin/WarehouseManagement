<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseStock extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'warehouse_id',
        'product_id',
        'qty_on_hand',
        'qty_reserved',
    ];

    protected $appends = ['qty_available'];

    protected $casts = [
        'qty_on_hand' => 'decimal:3',
        'qty_reserved' => 'decimal:3',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function getQtyAvailableAttribute(): string
    {
        $on = (float) $this->qty_on_hand;
        $res = (float) $this->qty_reserved;

        return number_format(max($on - $res, 0), 3, '.', '');
    }
}
