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

class VoucherWizardConfirmTest extends TestCase
{
    use RefreshDatabase;

    public function test_wizard_finish_sets_status_confirmed(): void
    {
        [$user, $voucher] = $this->draftVoucherWithOneLine();

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.finish', $voucher));

        $response->assertRedirect(route('admin.vouchers.index'));
        $voucher->refresh();
        $this->assertSame('CONFIRMED', $voucher->status);
    }

    public function test_wizard_finish_requires_at_least_one_line(): void
    {
        [$user, $voucher] = $this->draftVoucherWithoutLines();

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.finish', $voucher));

        $response->assertRedirect();
        $voucher->refresh();
        $this->assertSame('DRAFT', $voucher->status);
    }

    public function test_wizard_edit_returns_404_when_voucher_not_draft(): void
    {
        [$user, $voucher] = $this->draftVoucherWithOneLine();
        $voucher->forceFill(['status' => 'CONFIRMED'])->save();

        $response = $this->actingAs($user)->get(route('admin.vouchers.wizard.edit', $voucher));

        $response->assertNotFound();
    }

    public function test_wizard_finish_forbidden_when_already_confirmed(): void
    {
        [$user, $voucher] = $this->draftVoucherWithOneLine();
        $voucher->forceFill(['status' => 'CONFIRMED'])->save();

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.finish', $voucher));

        $response->assertForbidden();
    }

    /**
     * @return array{0: User, 1: Voucher}
     */
    private function draftVoucherWithOneLine(): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantWizardPermissions($user);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Confirm Test Merchant',
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
            'voucher_no' => 'V-CONFIRM01',
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

    /**
     * @return array{0: User, 1: Voucher}
     */
    private function draftVoucherWithoutLines(): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantWizardPermissions($user);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Empty Draft Merchant',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);

        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-NOLINES01',
            'voucher_date' => '2026-05-10',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'total_qty' => 0,
            'total_amount' => null,
            'remark' => null,
            'created_by' => $user->id,
        ]);

        return [$user, $voucher];
    }

    private function grantWizardPermissions(User $user): void
    {
        $codes = ['vouchers.manage', 'inventory.manage'];
        $ids = [];
        foreach ($codes as $code) {
            $p = Permission::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'module' => 'test']
            );
            $ids[] = $p->id;
        }

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Wizard Confirm Tester',
            'code' => 'wizard_confirm_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync($ids);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
