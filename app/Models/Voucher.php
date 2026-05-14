<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Voucher extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'voucher_no',
        'voucher_date',
        'source_warehouse_id',
        'merchant_id',
        'status',
        'payment_status',
        'total_qty',
        'total_weight',
        'total_amount',
        'additional_costs',
        'remark',
        'default_to_warehouse_id',
        'default_to_city',
        'default_to_address_line1',
        'default_to_address_line2',
        'default_to_township',
        'default_to_region',
        'default_to_postal_code',
        'default_recipient_name',
        'default_recipient_phone',
        'created_by',
    ];

    protected $casts = [
        'voucher_date' => 'date',
        'total_qty' => 'decimal:3',
        'total_weight' => 'decimal:3',
        'total_amount' => 'decimal:2',
        'additional_costs' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function sourceWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function defaultToWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'default_to_warehouse_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(VoucherItem::class)->orderBy('line_no');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(VoucherPayment::class)->orderByDesc('paid_at');
    }

    public function isDraft(): bool
    {
        return $this->status === 'DRAFT';
    }
}
