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
use App\Models\VoucherPayment;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_record_payment_forbidden_without_payments_manage(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithTotal('100.00');
        $viewer = User::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $this->grantVoucherViewOnly($viewer);

        $response = $this->actingAs($viewer)->post(route('admin.vouchers.payments.store', $voucher), [
            'amount' => 50,
            'payment_method' => 'CASH',
            'paid_at' => '2026-05-10 12:00:00',
        ]);

        $response->assertForbidden();
        $this->assertSame(0, VoucherPayment::query()->where('voucher_id', $voucher->id)->count());
    }

    public function test_record_payment_sets_paid_when_amount_covers_total(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithTotal('100.00');
        $this->grantPaymentsManage($user);

        $response = $this->actingAs($user)->post(route('admin.vouchers.payments.store', $voucher), [
            'amount' => 100,
            'payment_method' => 'CASH',
            'paid_at' => '2026-05-10 12:00:00',
        ]);

        $response->assertRedirect(route('admin.vouchers.show', $voucher));
        $this->assertSame(1, VoucherPayment::query()->where('voucher_id', $voucher->id)->count());
        $this->assertSame('PAID', $voucher->fresh()->payment_status);
    }

    public function test_record_partial_payment_sets_partial_status(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithTotal('100.00');
        $this->grantPaymentsManage($user);

        $this->actingAs($user)->post(route('admin.vouchers.payments.store', $voucher), [
            'amount' => 40,
            'payment_method' => 'TRANSFER',
            'paid_at' => '2026-05-10 12:00:00',
        ]);

        $this->assertSame('PARTIAL', $voucher->fresh()->payment_status);
        $this->assertSame('40.00', (string) VoucherPayment::query()->where('voucher_id', $voucher->id)->value('amount'));
    }

    public function test_record_payment_prevents_overpayment(): void
    {
        [$user, $voucher] = $this->confirmedVoucherWithTotal('100.00');
        $this->grantPaymentsManage($user);

        $response = $this->actingAs($user)->post(route('admin.vouchers.payments.store', $voucher), [
            'amount' => 150,
            'payment_method' => 'CASH',
            'paid_at' => '2026-05-10 12:00:00',
        ]);

        $response->assertInvalid(['amount']);
        $this->assertSame(0, VoucherPayment::query()->where('voucher_id', $voucher->id)->count());
    }

    /**
     * @return array{0: User, 1: Voucher}
     */
    private function confirmedVoucherWithTotal(string $totalAmount): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantVoucherViewOnly($user);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Payment Test Merchant',
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
            'voucher_no' => 'V-PAY01',
            'voucher_date' => '2026-05-10',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => $totalAmount,
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

    private function grantVoucherViewOnly(User $user): void
    {
        $p = Permission::query()->firstOrCreate(
            ['code' => 'vouchers.view'],
            ['name' => 'View vouchers', 'module' => 'voucher']
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Voucher View Only',
            'code' => 'voucher_view_paytest_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync([$p->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function grantPaymentsManage(User $user): void
    {
        foreach (['vouchers.view', 'payments.manage'] as $code) {
            $p = Permission::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'module' => 'test']
            );
            $role = Role::query()->create([
                'organization_id' => $user->organization_id,
                'name' => 'Pay '.$code,
                'code' => str_replace('.', '_', $code).'_'.mt_rand(1000, 9999),
                'is_system_role' => false,
            ]);
            $role->permissions()->sync([$p->id]);
            $user->roles()->syncWithoutDetaching([$role->id]);
        }
    }
}
