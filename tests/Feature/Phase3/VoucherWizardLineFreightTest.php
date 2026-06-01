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

class VoucherWizardLineFreightTest extends TestCase
{
    use RefreshDatabase;

    public function test_wizard_line_computes_freight_when_amount_omitted(): void
    {
        [$user, $voucher, $warehouse, $product] = $this->wizardFixtures();

        $payload = $this->minimalLinePayload($warehouse->id, $product->id);
        $payload['qty'] = 2;
        $payload['freight_rate'] = 5;

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.lines.store', $voucher), $payload);

        $response->assertRedirect();
        $item = VoucherItem::query()->where('voucher_id', $voucher->id)->first();
        $this->assertNotNull($item);
        $this->assertSame(10.0, (float) $item->freight_amount);
    }

    public function test_wizard_line_respects_explicit_freight_amount_override(): void
    {
        [$user, $voucher, $warehouse, $product] = $this->wizardFixtures();

        $payload = $this->minimalLinePayload($warehouse->id, $product->id);
        $payload['qty'] = 2;
        $payload['freight_rate'] = 5;
        $payload['freight_amount'] = 12.5;

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.lines.store', $voucher), $payload);

        $response->assertRedirect();
        $item = VoucherItem::query()->where('voucher_id', $voucher->id)->first();
        $this->assertNotNull($item);
        $this->assertSame(12.5, (float) $item->freight_amount);
    }

    public function test_wizard_line_uses_selected_product_id_before_typed_name_lookup(): void
    {
        [$user, $voucher, $warehouse, $product] = $this->wizardFixtures();
        $otherProduct = Product::factory()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Typed product name',
            'unit' => 'bag',
        ]);

        $payload = $this->minimalLinePayload($warehouse->id, $product->id);
        $payload['product_name'] = $otherProduct->name;

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.lines.store', $voucher), $payload);

        $response->assertRedirect();
        $item = VoucherItem::query()->where('voucher_id', $voucher->id)->firstOrFail();
        $this->assertSame($product->id, (int) $item->product_id);
    }

    public function test_wizard_line_updates_selected_master_product_unit(): void
    {
        [$user, $voucher, $warehouse, $product] = $this->wizardFixtures();

        $payload = $this->minimalLinePayload($warehouse->id, $product->id);
        $payload['unit'] = 'box';

        $response = $this->actingAs($user)->post(route('admin.vouchers.wizard.lines.store', $voucher), $payload);

        $response->assertRedirect();
        $item = VoucherItem::query()->where('voucher_id', $voucher->id)->firstOrFail();
        $this->assertSame('box', $item->unit);
        $this->assertSame('box', $product->fresh()->unit);
    }

    /**
     * @return array{0: User, 1: Voucher, 2: Warehouse, 3: Product}
     */
    private function wizardFixtures(): array
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
            'name' => 'Freight Test Merchant',
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
            'voucher_no' => 'V-FREIGHT01',
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

        return [$user, $voucher, $warehouse, $product];
    }

    /**
     * @return array<string, mixed>
     */
    private function minimalLinePayload(int $warehouseId, int $productId): array
    {
        return [
            'product_id' => $productId,
            'from_warehouse_id' => $warehouseId,
            'to_warehouse_id' => null,
            'to_city' => 'Yangon',
            'to_address_line1' => '123 Test Street',
            'to_address_line2' => null,
            'to_township' => null,
            'to_region' => null,
            'to_postal_code' => null,
            'recipient_name' => null,
            'recipient_phone' => null,
            'qty' => 1,
            'unit' => 'piece',
            'description' => null,
            'is_fragile' => false,
        ];
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
            'name' => 'Freight Tester',
            'code' => 'freight_tester_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync($ids);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
