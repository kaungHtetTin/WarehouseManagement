<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'status',
        'default_locale',
    ];

    protected static function booted(): void
    {
        static::created(function (Organization $org) {
            $defaults = [
                ['name' => 'Labor', 'sort_order' => 10],
                ['name' => 'Tax', 'sort_order' => 20],
            ];

            foreach ($defaults as $row) {
                $existing = VoucherAdditionalCostCategory::withTrashed()
                    ->where('organization_id', $org->id)
                    ->where('name', $row['name'])
                    ->first();

                if ($existing) {
                    if ($existing->trashed()) {
                        $existing->restore();
                    }
                    $existing->status = 'ACTIVE';
                    $existing->sort_order = (int) $row['sort_order'];
                    $existing->save();
                    continue;
                }

                VoucherAdditionalCostCategory::query()->create([
                    'organization_id' => $org->id,
                    'name' => $row['name'],
                    'status' => 'ACTIVE',
                    'sort_order' => (int) $row['sort_order'],
                ]);
            }

            $financeDefaults = [
                [
                    'scope' => 'VOUCHER',
                    'direction' => 'INCOME',
                    'name' => 'Voucher Payment',
                    'sort_order' => 10,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Salary',
                    'sort_order' => 10,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Rent',
                    'sort_order' => 20,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Utilities',
                    'sort_order' => 30,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Internet',
                    'sort_order' => 40,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Office supplies',
                    'sort_order' => 50,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'INCOME',
                    'name' => 'Other income',
                    'sort_order' => 900,
                ],
                [
                    'scope' => 'GENERAL',
                    'direction' => 'EXPENSE',
                    'name' => 'Other expense',
                    'sort_order' => 910,
                ],
                [
                    'scope' => 'TRIP_COST',
                    'direction' => 'EXPENSE',
                    'name' => 'Fuel',
                    'sort_order' => 10,
                ],
                [
                    'scope' => 'TRIP_COST',
                    'direction' => 'EXPENSE',
                    'name' => 'Toll',
                    'sort_order' => 20,
                ],
            ];

            foreach ($financeDefaults as $row) {
                $existing = FinanceCategory::withTrashed()
                    ->where('organization_id', $org->id)
                    ->where('scope', $row['scope'])
                    ->where('name', $row['name'])
                    ->first();

                if ($existing) {
                    if ($existing->trashed()) {
                        $existing->restore();
                    }
                    $existing->direction = $row['direction'];
                    $existing->status = 'ACTIVE';
                    $existing->sort_order = (int) $row['sort_order'];
                    $existing->save();
                    continue;
                }

                FinanceCategory::query()->create([
                    'organization_id' => $org->id,
                    'scope' => $row['scope'],
                    'direction' => $row['direction'],
                    'name' => $row['name'],
                    'status' => 'ACTIVE',
                    'sort_order' => (int) $row['sort_order'],
                ]);
            }
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function warehouses(): HasMany
    {
        return $this->hasMany(Warehouse::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function merchants(): HasMany
    {
        return $this->hasMany(Merchant::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }

    public function publicPage(): HasOne
    {
        return $this->hasOne(OrganizationPublicPage::class);
    }
}
