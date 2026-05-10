<?php

namespace Tests\Feature\Phase3;

use App\Models\Category;
use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_update_voucher_from_other_tenant(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'vouchers.manage');

        $otherOrganization = Organization::factory()->create();
        $foreignVoucher = $this->makeDraftVoucherForOrganization($otherOrganization);

        $response = $this->actingAs($actor)->patch(route('admin.vouchers.update', $foreignVoucher), [
            'voucher_date' => now()->toDateString(),
            'source_warehouse_id' => 1,
            'merchant_id' => 1,
            'items' => [],
        ]);

        $response->assertNotFound();
    }

    public function test_cannot_delete_voucher_from_other_tenant(): void
    {
        [$organization, $actor] = $this->createTenantUser();
        $this->grantPermission($actor, 'vouchers.manage');

        $otherOrganization = Organization::factory()->create();
        $foreignVoucher = $this->makeDraftVoucherForOrganization($otherOrganization);

        $response = $this->actingAs($actor)->delete(route('admin.vouchers.destroy', $foreignVoucher));

        $response->assertNotFound();
    }

    private function makeDraftVoucherForOrganization(Organization $organization): Voucher
    {
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Foreign Merchant',
        ]);
        $category = Category::factory()->create(['organization_id' => $organization->id]);
        $product = Product::factory()->withCategory($category)->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-FOREIGNTEST01',
            'voucher_date' => now()->toDateString(),
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => null,
            'remark' => null,
            'created_by' => null,
        ]);

        VoucherItem::query()->create([
            'organization_id' => $organization->id,
            'voucher_id' => $voucher->id,
            'line_no' => 1,
            'product_id' => $product->id,
            'description' => null,
            'from_warehouse_id' => $warehouse->id,
            'to_warehouse_id' => null,
            'to_city' => null,
            'qty' => 1,
            'loaded_qty' => 0,
            'delivered_qty' => 0,
            'unit' => 'bag',
            'freight_rate' => null,
            'freight_amount' => null,
            'payment_status' => 'UNPAID',
            'is_fragile' => false,
        ]);

        return $voucher;
    }

    private function createTenantUser(): array
    {
        $organization = Organization::factory()->create();
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        return [$organization, $user];
    }

    private function grantPermission(User $user, string $permissionCode): void
    {
        $permission = Permission::query()->firstOrCreate(
            ['code' => $permissionCode],
            ['name' => $permissionCode, 'module' => 'voucher']
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Voucher Admin',
            'code' => 'voucher_admin_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
