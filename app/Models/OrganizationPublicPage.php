<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationPublicPage extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'slug',
        'is_published',
        'theme_color',
        'business_name',
        'about',
        'phone',
        'email',
        'address',
        'logo_url',
        'cover_url',
        'kpis',
        'services',
        'gallery',
        'faqs',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'kpis' => 'array',
        'services' => 'array',
        'gallery' => 'array',
        'faqs' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
