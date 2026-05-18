<?php

namespace Tests\Feature\Phase3;

use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherWizardStep1Test extends TestCase
{
    use RefreshDatabase;

    public function test_wizard_step1_creates_draft_voucher_and_merchant(): void
    {
        $organization = Organization::factory()->create();
        $sourceWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $destinationWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['vouchers.manage', 'inventory.manage']);

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.step1'), [
            'voucher_date' => '2026-05-01',
            'source_warehouse_id' => $sourceWarehouse->id,
            'remark' => 'Test remark',
            'payment_status' => 'PAID',
            'merchant_id' => null,
            'merchant' => [
                'name' => 'Wizard Merchant',
                'phone' => '0999000111',
            ],
            'default_to_warehouse_id' => $destinationWarehouse->id,
            'default_recipient_name' => 'U Receiver',
            'default_recipient_phone' => '091234567',
            'default_destination_remark' => 'Deliver to destination warehouse front desk.',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('merchants', [
            'organization_id' => $organization->id,
            'name' => 'Wizard Merchant',
            'phone' => '0999000111',
        ]);
        $this->assertSame(1, Voucher::query()->where('organization_id', $organization->id)->count());
        $voucher = Voucher::query()->where('organization_id', $organization->id)->first();
        $this->assertSame('DRAFT', $voucher->status);
        $this->assertSame('PAID', $voucher->payment_status);
        $this->assertSame($destinationWarehouse->id, (int) $voucher->default_to_warehouse_id);
        $this->assertSame($destinationWarehouse->city, $voucher->default_to_city);
        $this->assertSame($destinationWarehouse->address, $voucher->default_to_address_line1);
        $this->assertSame('U Receiver', $voucher->default_recipient_name);
        $this->assertSame('Deliver to destination warehouse front desk.', $voucher->default_destination_remark);
    }

    public function test_wizard_edit_page_loads_draft_voucher(): void
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['vouchers.manage', 'inventory.manage']);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Edit Test Merchant',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);
        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-TEDIT01',
            'voucher_date' => '2026-05-02',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'total_qty' => 0,
            'total_amount' => null,
            'remark' => null,
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)->get(route('admin.vouchers.wizard.edit', $voucher));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Operations/VoucherWizard')
            ->has('voucher', fn ($v) => $v
                ->where('id', $voucher->id)
                ->where('voucher_no', 'V-TEDIT01')
                ->etc()));
    }

    public function test_wizard_edit_returns_404_for_non_draft(): void
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['vouchers.manage', 'inventory.manage']);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'M',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);
        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => 'V-TCONF01',
            'voucher_date' => '2026-05-02',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_qty' => 0,
            'total_amount' => null,
            'remark' => null,
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)->get(route('admin.vouchers.wizard.edit', $voucher));

        $response->assertNotFound();
    }

    private function grantPermissions(User $user, array $codes): void
    {
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
            'name' => 'Wizard Tester',
            'code' => 'wizard_tester_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync($ids);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
