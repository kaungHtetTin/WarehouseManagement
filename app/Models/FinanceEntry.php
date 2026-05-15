<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FinanceEntry extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'warehouse_id',
        'scope',
        'direction',
        'category_id',
        'amount',
        'currency',
        'occurred_at',
        'note',
        'reference_type',
        'reference_id',
        'source',
        'created_by',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinanceCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
