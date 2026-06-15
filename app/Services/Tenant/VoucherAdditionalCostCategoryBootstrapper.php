<?php

namespace App\Services\Tenant;

use App\Models\VoucherAdditionalCostCategory;

class VoucherAdditionalCostCategoryBootstrapper
{
    /**
     * Create default voucher additional cost categories for a tenant.
     */
    public function bootstrap(int $organizationId): array
    {
        $defaults = [
            'labor' => ['name' => 'Labor', 'sort_order' => 10],
            'tax' => ['name' => 'Tax', 'sort_order' => 20],
        ];

        $categories = [];

        foreach ($defaults as $key => $row) {
            $category = VoucherAdditionalCostCategory::withTrashed()
                ->where('organization_id', $organizationId)
                ->where('name', $row['name'])
                ->first();

            if (! $category) {
                $category = new VoucherAdditionalCostCategory([
                    'organization_id' => $organizationId,
                    'name' => $row['name'],
                ]);
            }

            if ($category->trashed()) {
                $category->restore();
            }

            $category->status = 'ACTIVE';
            $category->sort_order = (int) $row['sort_order'];
            $category->is_system = true;
            $category->save();

            $categories[$key] = $category;
        }

        return $categories;
    }
}
