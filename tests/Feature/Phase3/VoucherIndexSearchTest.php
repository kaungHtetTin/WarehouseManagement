<?php

namespace Tests\Feature\Phase3;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherIndexSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_voucher_index_search_matches_voucher_number_recipient_name_and_phone(): void
    {
        [$user, $warehouse] = $this->createViewerWithAssignedWarehouse();

        $voucherByNumber = $this->createVoucher($user, $warehouse, [
            'voucher_no' => 'V-MPPKGPCDKIR',
            'default_recipient_name' => 'Alice Receiver',
            'default_recipient_phone' => '091111111',
        ]);

        $voucherByName = $this->createVoucher($user, $warehouse, [
            'voucher_no' => 'V-SEARCHNAME1',
            'default_recipient_name' => 'Ko Search Name',
            'default_recipient_phone' => '092222222',
        ]);

        $voucherByPhone = $this->createVoucher($user, $warehouse, [
            'voucher_no' => 'V-SEARCHPHONE1',
            'default_recipient_name' => 'Phone Receiver',
            'default_recipient_phone' => '09987654321',
        ]);

        $this->createVoucher($user, $warehouse, [
            'voucher_no' => 'V-NOMATCH0001',
            'default_recipient_name' => 'Other Person',
            'default_recipient_phone' => '093333333',
        ]);

        $this->actingAs($user)
            ->get(route('admin.vouchers.index', ['search' => 'V-MPPKGPCDKIR']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/VouchersIndex')
                ->where('voucher_search_filter', 'V-MPPKGPCDKIR')
                ->has('vouchers', 1)
                ->where('vouchers.0.id', $voucherByNumber->id)
                ->where('vouchers.0.voucher_no', $voucherByNumber->voucher_no)
                ->etc());

        $this->actingAs($user)
            ->get(route('admin.vouchers.index', ['search' => 'Ko Search']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/VouchersIndex')
                ->where('voucher_search_filter', 'Ko Search')
                ->has('vouchers', 1)
                ->where('vouchers.0.id', $voucherByName->id)
                ->where('vouchers.0.default_recipient_name', $voucherByName->default_recipient_name)
                ->etc());

        $this->actingAs($user)
            ->get(route('admin.vouchers.index', ['search' => '09987654321']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/VouchersIndex')
                ->where('voucher_search_filter', '09987654321')
                ->has('vouchers', 1)
                ->where('vouchers.0.id', $voucherByPhone->id)
                ->where('vouchers.0.default_recipient_phone', $voucherByPhone->default_recipient_phone)
                ->etc());
    }

    public function test_voucher_index_can_filter_by_source_warehouse(): void
    {
        [$user, $warehouses] = $this->createViewerWithAssignedWarehouses(2);
        [$sourceWarehouseA, $sourceWarehouseB] = $warehouses;

        $voucherFromA = $this->createVoucher($user, $sourceWarehouseA, [
            'voucher_no' => 'V-SRC-A',
            'default_to_warehouse_id' => $sourceWarehouseA->id,
            'default_to_city' => $sourceWarehouseA->city,
            'default_to_address_line1' => $sourceWarehouseA->address,
        ]);

        $voucherFromB = $this->createVoucher($user, $sourceWarehouseB, [
            'voucher_no' => 'V-SRC-B',
            'default_to_warehouse_id' => $sourceWarehouseA->id,
            'default_to_city' => $sourceWarehouseA->city,
            'default_to_address_line1' => $sourceWarehouseA->address,
        ]);

        $this->actingAs($user)
            ->get(route('admin.vouchers.index', ['source_warehouse_id' => $sourceWarehouseB->id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Operations/VouchersIndex')
                ->where('voucher_source_warehouse_filter', (string) $sourceWarehouseB->id)
                ->has('vouchers', 1)
                ->where('vouchers.0.id', $voucherFromB->id)
                ->where('vouchers.0.voucher_no', $voucherFromB->voucher_no)
                ->etc());
    }

    /**
     * @return array{0: User, 1: Warehouse}
     */
    private function createViewerWithAssignedWarehouse(): array
    {
        [$user, $warehouses] = $this->createViewerWithAssignedWarehouses(1);

        return [$user, $warehouses[0]];
    }

    private function createVoucher(User $user, Warehouse $warehouse, array $overrides = []): Voucher
    {
        return Voucher::query()->create(array_merge([
            'organization_id' => $user->organization_id,
            'voucher_no' => 'V-TEST'.mt_rand(1000, 9999),
            'voucher_date' => '2026-05-28',
            'source_warehouse_id' => $warehouse->id,
            'merchant_id' => null,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => null,
            'created_by' => $user->id,
            'default_to_warehouse_id' => $warehouse->id,
            'default_to_city' => $warehouse->city,
            'default_to_address_line1' => $warehouse->address,
            'default_recipient_name' => null,
            'default_recipient_phone' => null,
            'default_destination_remark' => null,
            'remark' => null,
        ], $overrides));
    }

    /**
     * @return array{0: User, 1: array<int, Warehouse>}
     */
    private function createViewerWithAssignedWarehouses(int $count): array
    {
        $organization = Organization::factory()->create();
        $warehouses = Warehouse::factory()->count($count)->create([
            'organization_id' => $organization->id,
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        $permission = Permission::query()->firstOrCreate(
            ['code' => 'vouchers.view'],
            ['name' => 'View vouchers', 'module' => 'voucher']
        );

        $role = Role::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Voucher Viewer',
            'code' => 'voucher_viewer_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
        foreach ($warehouses as $warehouse) {
            $user->warehouses()->attach($warehouse->id, ['access_level' => 'VIEW']);
        }

        return [$user, $warehouses->all()];
    }
}
