<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoucherPayment extends Model
{
    protected $fillable = [
        'organization_id',
        'voucher_id',
        'voucher_item_id',
        'amount',
        'currency',
        'payment_method',
        'paid_at',
        'reference_no',
        'received_by',
        'note',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function voucherItem(): BelongsTo
    {
        return $this->belongsTo(VoucherItem::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
