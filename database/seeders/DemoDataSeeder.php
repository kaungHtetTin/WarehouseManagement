<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Product;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\Warehouse;
use App\Services\Tenant\TenantRoleBootstrapper;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Sample tenant (organization, admin user, master data) for local / QA testing.
 * Requires permissions — runs SystemDataSeeder first if the catalog is empty.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (! Permission::query()->exists()) {
            $this->call(SystemDataSeeder::class);
        }

        $orgCode = config('demo.organization_code');
        $orgName = config('demo.organization_name');
        $locale = config('demo.default_locale');

        DB::transaction(function () use ($orgCode, $orgName, $locale) {
            $organization = Organization::query()->updateOrCreate(
                ['code' => $orgCode],
                [
                    'name' => $orgName,
                    'status' => 'ACTIVE',
                    'default_locale' => in_array($locale, ['en', 'mm'], true) ? $locale : 'mm',
                ]
            );

            $roles = app(TenantRoleBootstrapper::class)->bootstrap($organization->id);

            $user = User::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'email' => config('demo.admin_email'),
                ],
                [
                    'name' => config('demo.admin_name'),
                    'password' => Hash::make(config('demo.admin_password')),
                    'status' => 'ACTIVE',
                    'email_verified_at' => now(),
                ]
            );

            $user->roles()->sync([$roles['super_admin']->id]);

            $mainWh = Warehouse::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'city' => 'Yangon',
                    'address' => 'Demo street 1',
                ],
                [
                    'city' => 'Yangon',
                    'address' => 'Demo street 1',
                ]
            );

            Warehouse::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'city' => 'Mandalay',
                    'address' => 'Demo street 2',
                ],
                [
                    'city' => 'Mandalay',
                    'address' => 'Demo street 2',
                ]
            );

            $category = Category::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'name' => 'General',
                ],
                [
                    'code' => 'GEN',
                    'parent_id' => null,
                ]
            );

            $productA = Product::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'sku' => 'DEMO-RICE-25KG',
                ],
                [
                    'category_id' => $category->id,
                    'name' => 'Rice 25kg',
                    'unit' => 'bag',
                    'default_weight' => 25,
                    'status' => 'ACTIVE',
                ]
            );

            $productB = Product::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'sku' => 'DEMO-OIL-1L',
                ],
                [
                    'category_id' => $category->id,
                    'name' => 'Cooking oil 1L',
                    'unit' => 'bottle',
                    'default_weight' => 1,
                    'status' => 'ACTIVE',
                ]
            );

            $merchant = Merchant::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'name' => 'Demo Merchant Trading',
                ],
                [
                    'phone' => '09123456789',
                    'nrc_or_id' => null,
                    'address' => 'Demo merchant address',
                ]
            );

            $voucherDate = now()->toDateString();

            $v1 = Voucher::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'voucher_no' => 'DEMO-V-2026-001',
                ],
                [
                    'voucher_date' => $voucherDate,
                    'source_warehouse_id' => $mainWh->id,
                    'merchant_id' => $merchant->id,
                    'status' => 'CONFIRMED',
                    'payment_status' => 'UNPAID',
                    'total_qty' => '40.000',
                    'total_amount' => null,
                    'remark' => 'Demo confirmed — rice to Mandalay branch',
                    'created_by' => $user->id,
                ]
            );
            VoucherItem::query()->updateOrCreate(
                [
                    'voucher_id' => $v1->id,
                    'line_no' => 1,
                ],
                [
                    'organization_id' => $organization->id,
                    'product_id' => $productA->id,
                    'description' => null,
                    'from_warehouse_id' => $mainWh->id,
                    'to_warehouse_id' => null,
                    'to_city' => 'Mandalay',
                    'to_address_line1' => null,
                    'to_address_line2' => null,
                    'to_township' => null,
                    'to_region' => null,
                    'to_postal_code' => null,
                    'recipient_name' => null,
                    'recipient_phone' => null,
                    'qty' => '40.000',
                    'loaded_qty' => '0.000',
                    'delivered_qty' => '0.000',
                    'unit' => $productA->unit,
                    'freight_rate' => null,
                    'freight_amount' => null,
                    'payment_status' => 'UNPAID',
                    'is_fragile' => false,
                ]
            );

            $v2 = Voucher::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'voucher_no' => 'DEMO-V-2026-002',
                ],
                [
                    'voucher_date' => $voucherDate,
                    'source_warehouse_id' => $mainWh->id,
                    'merchant_id' => $merchant->id,
                    'status' => 'CONFIRMED',
                    'payment_status' => 'UNPAID',
                    'total_qty' => '60.000',
                    'total_amount' => null,
                    'remark' => 'Demo confirmed — cooking oil',
                    'created_by' => $user->id,
                ]
            );
            VoucherItem::query()->updateOrCreate(
                [
                    'voucher_id' => $v2->id,
                    'line_no' => 1,
                ],
                [
                    'organization_id' => $organization->id,
                    'product_id' => $productB->id,
                    'description' => null,
                    'from_warehouse_id' => $mainWh->id,
                    'to_warehouse_id' => null,
                    'to_city' => 'Yangon',
                    'to_address_line1' => 'Industrial zone road 5',
                    'to_address_line2' => null,
                    'to_township' => null,
                    'to_region' => null,
                    'to_postal_code' => null,
                    'recipient_name' => 'Demo receiver',
                    'recipient_phone' => '09987654321',
                    'qty' => '60.000',
                    'loaded_qty' => '0.000',
                    'delivered_qty' => '0.000',
                    'unit' => $productB->unit,
                    'freight_rate' => null,
                    'freight_amount' => null,
                    'payment_status' => 'UNPAID',
                    'is_fragile' => false,
                ]
            );

            $v3 = Voucher::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'voucher_no' => 'DEMO-V-2026-003',
                ],
                [
                    'voucher_date' => $voucherDate,
                    'source_warehouse_id' => $mainWh->id,
                    'merchant_id' => $merchant->id,
                    'status' => 'DRAFT',
                    'payment_status' => 'UNPAID',
                    'total_qty' => '15.000',
                    'total_amount' => null,
                    'remark' => 'Demo draft — edit in voucher wizard',
                    'created_by' => $user->id,
                ]
            );
            VoucherItem::query()->updateOrCreate(
                [
                    'voucher_id' => $v3->id,
                    'line_no' => 1,
                ],
                [
                    'organization_id' => $organization->id,
                    'product_id' => $productA->id,
                    'description' => null,
                    'from_warehouse_id' => $mainWh->id,
                    'to_warehouse_id' => null,
                    'to_city' => null,
                    'to_address_line1' => null,
                    'to_address_line2' => null,
                    'to_township' => null,
                    'to_region' => null,
                    'to_postal_code' => null,
                    'recipient_name' => null,
                    'recipient_phone' => null,
                    'qty' => '15.000',
                    'loaded_qty' => '0.000',
                    'delivered_qty' => '0.000',
                    'unit' => $productA->unit,
                    'freight_rate' => null,
                    'freight_amount' => null,
                    'payment_status' => 'UNPAID',
                    'is_fragile' => false,
                ]
            );

            Vehicle::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'vehicle_no' => 'DEMO-TRUCK-01',
                ],
                [
                    'warehouse_id' => $mainWh->id,
                    'vehicle_type' => 'TRUCK',
                    'capacity_weight' => 5000,
                    'capacity_volume' => null,
                    'status' => 'ACTIVE',
                ]
            );

            Vehicle::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'vehicle_no' => 'DEMO-VAN-02',
                ],
                [
                    'warehouse_id' => null,
                    'vehicle_type' => 'VAN',
                    'capacity_weight' => 1500,
                    'capacity_volume' => null,
                    'status' => 'ACTIVE',
                ]
            );
        });

        if ($this->command) {
            $this->command->info('Demo tenant seeded.');
            $this->command->info('  Organization: '.config('demo.organization_name').' ('.config('demo.organization_code').')');
            $this->command->info('  Login: '.config('demo.admin_email').' / '.config('demo.admin_password'));
            $this->command->info('  Vouchers: DEMO-V-2026-001 (CONFIRMED), DEMO-V-2026-002 (CONFIRMED), DEMO-V-2026-003 (DRAFT)');
        }
    }
}
