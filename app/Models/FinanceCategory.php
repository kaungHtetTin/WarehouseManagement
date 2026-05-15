<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FinanceCategory extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'scope',
        'direction',
        'name',
        'status',
        'sort_order',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}

