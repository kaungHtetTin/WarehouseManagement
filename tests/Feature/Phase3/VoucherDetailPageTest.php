<?php

namespace Tests\Feature\Phase3;

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

class VoucherDetailPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_confirmed_voucher_detail_page_loads_for_same_tenant(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();

        $response = $this->actingAs($user)->get(route('admin.vouchers.show', $voucher));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Operations/VoucherDetail')
            ->has('voucher', fn ($v) => $v
                ->where('id', $voucher->id)
                ->where('status', 'CONFIRMED')
                ->has('items', 1)
                ->etc()));
    }

    public function test_draft_voucher_detail_returns_404(): void
    {
        [$user, $voucher] = $this->draftVoucherWithLine();

        $response = $this->actingAs($user)->get(route('admin.vouchers.show', $voucher));

        $response->assertNotFound();
    }

    public function test_voucher_print_qr_tracking_url_defaults_to_myanmar(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();
        $organization = Organization::query()->findOrFail($voucher->organization_id);

        $response = $this->actingAs($user)->get(route('admin.vouchers.print', $voucher));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Operations/VoucherPrint')
            ->where('tracking_url', route('public.voucher.track', [
                'org' => $organization->code,
                'voucherNo' => $voucher->voucher_no,
                'locale' => 'my',
            ])));
    }

    public function test_voucher_detail_not_found_for_other_tenant(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();

        $other = User::factory()->create([
            'organization_id' => Organization::factory()->create()->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantViewPermission($other);

        $response = $this->actingAs($other)->get(route('admin.vouchers.show', $voucher));

        $response->assertNotFound();
    }

    public function test_vouchers_view_permission_required(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();

        $viewer = User::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $this->grantViewPermission($viewer);

        $response = $this->actingAs($viewer)->get(route('admin.vouchers.show', $voucher));

        $response->assertOk();
    }

    public function test_manager_can_update_confirmed_voucher_details_from_detail_page(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();

        $response = $this->actingAs($user)->patch(route('admin.vouchers.details.update', $voucher), [
            'default_recipient_name' => ' New Recipient ',
            'default_recipient_phone' => ' 09123456789 ',
            'default_destination_remark' => ' Leave at the front desk. ',
            'total_weight' => '12',
        ]);

        $response->assertRedirect();

        $voucher->refresh();
        $this->assertSame('New Recipient', $voucher->default_recipient_name);
        $this->assertSame('09123456789', $voucher->default_recipient_phone);
        $this->assertSame('Leave at the front desk.', $voucher->default_destination_remark);
        $this->assertSame('12.000', $voucher->total_weight);
    }

    public function test_voucher_detail_weight_must_be_a_whole_number(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithLine();

        $response = $this->actingAs($user)->patch(route('admin.vouchers.details.update', $voucher), [
            'default_recipient_name' => 'Recipient',
            'default_recipient_phone' => '09123456789',
            'default_destination_remark' => null,
            'total_weight' => '12.5',
        ]);

        $response->assertSessionHasErrors('total_weight');
    }

    /**
     * @return array{0: User, 1: Voucher}
     */
    private function confirmedVoucherWithLine(): array
    {
        [$user, $voucher] = $this->draftVoucherWithLine();
        $voucher->forceFill(['status' => 'CONFIRMED'])->save();

        return [$user, $voucher];
    }

    /**
     * @return array{0: User, 1: Voucher}
     */
    private function draftVoucherWithLine(): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantViewPermission($user);
        $this->grantManagePermissions($user);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Detail Test Merchant',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);

        $product = Product::factory()->create([
            'organization_id' => $organization->id,
            'unit' => 'piece',
        ]);

        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-DETAIL01',
            'voucher_date' => '2026-05-10',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => null,
            'remark' => null,
            'created_by' => $user->id,
        ]);

        VoucherItem::query()->create([
            'organization_id' => $organization->id,
            'voucher_id' => $voucher->id,
            'line_no' => 1,
            'product_id' => $product->id,
            'description' => null,
            'from_warehouse_id' => $warehouse->id,
            'to_warehouse_id' => null,
            'to_city' => 'Yangon',
            'to_address_line1' => '1 Test Rd',
            'to_address_line2' => null,
            'to_township' => null,
            'to_region' => null,
            'to_postal_code' => null,
            'recipient_name' => null,
            'recipient_phone' => null,
            'qty' => 1,
            'loaded_qty' => 0,
            'delivered_qty' => 0,
            'unit' => 'piece',
            'freight_rate' => null,
            'freight_amount' => null,
            'payment_status' => 'UNPAID',
            'is_fragile' => false,
        ]);

        return [$user, $voucher];
    }

    private function grantViewPermission(User $user): void
    {
        $p = Permission::query()->firstOrCreate(
            ['code' => 'vouchers.view'],
            ['name' => 'View vouchers', 'module' => 'voucher']
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Voucher Viewer',
            'code' => 'voucher_viewer_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync([$p->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function grantManagePermissions(User $user): void
    {
        foreach (['vouchers.manage', 'inventory.manage'] as $code) {
            $p = Permission::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'module' => 'test']
            );
            $role = Role::query()->create([
                'organization_id' => $user->organization_id,
                'name' => 'Detail Tester '.substr($code, -6),
                'code' => 'detail_'.str_replace('.', '_', $code).'_'.mt_rand(1000, 9999),
                'is_system_role' => false,
            ]);
            $role->permissions()->sync([$p->id]);
            $user->roles()->syncWithoutDetaching([$role->id]);
        }
    }
}
