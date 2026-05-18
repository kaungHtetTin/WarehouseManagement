<?php

namespace Tests\Feature\Phase3;

use App\Models\Merchant;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Trip;
use App\Models\TripItem;
use App\Models\TripStop;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TripWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_trip_create_requires_destination_warehouse_and_creates_single_stop(): void
    {
        $organization = Organization::factory()->create();
        $destinationWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);

        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['trips.manage', 'trips.view']);
        $user->warehouses()->attach($destinationWarehouse->id, ['access_level' => 'MANAGE']);

        $response = $this->actingAs($user)->post(route('admin.trips.store'), [
            'vehicle_id' => null,
            'vehicle' => [
                'vehicle_no' => 'MDY-1234',
                'capacity_weight' => 10,
            ],
            'destination_warehouse_id' => $destinationWarehouse->id,
            'driver_name' => null,
            'driver_phone' => null,
        ]);

        $response->assertRedirect();

        $trip = Trip::query()->where('organization_id', $organization->id)->first();
        $this->assertNotNull($trip);
        $this->assertSame($destinationWarehouse->id, (int) $trip->source_warehouse_id);
        $this->assertSame(1, TripStop::query()->where('trip_id', $trip->id)->count());
        $this->assertSame(
            $destinationWarehouse->id,
            (int) TripStop::query()->where('trip_id', $trip->id)->value('warehouse_id')
        );
    }

    public function test_trip_voucher_load_enforces_destination_match_and_capacity_weight(): void
    {
        $organization = Organization::factory()->create();
        $destinationWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $sourceWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);

        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['trips.manage', 'trips.view']);

        $vehicle = Vehicle::query()->create([
            'organization_id' => $organization->id,
            'vehicle_no' => 'YGN-9000',
            'vehicle_type' => 'GENERAL',
            'capacity_weight' => 10,
            'capacity_volume' => null,
            'status' => 'ACTIVE',
        ]);

        $trip = Trip::query()->create([
            'organization_id' => $organization->id,
            'trip_no' => 'T-'.mt_rand(1000, 9999),
            'vehicle_id' => $vehicle->id,
            'driver_name' => null,
            'driver_phone' => null,
            'source_warehouse_id' => $destinationWarehouse->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);
        TripStop::query()->create([
            'organization_id' => $organization->id,
            'trip_id' => $trip->id,
            'stop_order' => 1,
            'warehouse_id' => $destinationWarehouse->id,
            'status' => 'PENDING',
        ]);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Trip Test Merchant',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);

        $product = Product::factory()->create([
            'organization_id' => $organization->id,
            'unit' => 'piece',
        ]);

        $voucher1 = $this->confirmedVoucherWithLine(
            organization: $organization,
            user: $user,
            merchant: $merchant,
            product: $product,
            sourceWarehouse: $sourceWarehouse,
            destinationWarehouse: $destinationWarehouse,
            voucherNo: 'V-TRIP01',
            totalWeight: 7.0,
        );
        $voucher2 = $this->confirmedVoucherWithLine(
            organization: $organization,
            user: $user,
            merchant: $merchant,
            product: $product,
            sourceWarehouse: $sourceWarehouse,
            destinationWarehouse: $destinationWarehouse,
            voucherNo: 'V-TRIP02',
            totalWeight: 5.0,
        );

        $this->actingAs($user)
            ->post(route('admin.trips.vouchers.load', $trip), ['voucher_id' => $voucher1->id])
            ->assertRedirect(route('admin.trips.show', $trip));

        $response = $this->actingAs($user)->post(route('admin.trips.vouchers.load', $trip), ['voucher_id' => $voucher2->id]);
        $response->assertInvalid(['voucher_id']);

        $this->assertSame(1, (int) TripItem::query()->where('trip_id', $trip->id)->count());
    }

    public function test_trip_voucher_load_warns_when_total_weight_missing(): void
    {
        $organization = Organization::factory()->create();
        $destinationWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);
        $sourceWarehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
        ]);

        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantPermissions($user, ['trips.manage', 'trips.view']);

        $vehicle = Vehicle::query()->create([
            'organization_id' => $organization->id,
            'vehicle_no' => 'YGN-9001',
            'vehicle_type' => 'GENERAL',
            'capacity_weight' => 10,
            'capacity_volume' => null,
            'status' => 'ACTIVE',
        ]);

        $trip = Trip::query()->create([
            'organization_id' => $organization->id,
            'trip_no' => 'T-'.mt_rand(1000, 9999),
            'vehicle_id' => $vehicle->id,
            'driver_name' => null,
            'driver_phone' => null,
            'source_warehouse_id' => $destinationWarehouse->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);
        TripStop::query()->create([
            'organization_id' => $organization->id,
            'trip_id' => $trip->id,
            'stop_order' => 1,
            'warehouse_id' => $destinationWarehouse->id,
            'status' => 'PENDING',
        ]);

        $merchant = Merchant::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Trip Test Merchant',
            'phone' => null,
            'nrc_or_id' => null,
            'address' => null,
        ]);

        $product = Product::factory()->create([
            'organization_id' => $organization->id,
            'unit' => 'piece',
        ]);

        $voucher = $this->confirmedVoucherWithLine(
            organization: $organization,
            user: $user,
            merchant: $merchant,
            product: $product,
            sourceWarehouse: $sourceWarehouse,
            destinationWarehouse: $destinationWarehouse,
            voucherNo: 'V-TRIP03',
            totalWeight: null,
        );

        $response = $this->actingAs($user)->post(route('admin.trips.vouchers.load', $trip), ['voucher_id' => $voucher->id]);
        $response->assertRedirect(route('admin.trips.show', $trip));
        $response->assertSessionHas('warning');

        $this->assertSame(1, (int) TripItem::query()->where('trip_id', $trip->id)->count());
    }

    private function confirmedVoucherWithLine(
        Organization $organization,
        User $user,
        Merchant $merchant,
        Product $product,
        Warehouse $sourceWarehouse,
        Warehouse $destinationWarehouse,
        string $voucherNo,
        ?float $totalWeight,
    ): Voucher {
        $voucher = Voucher::query()->create([
            'organization_id' => $organization->id,
            'voucher_no' => $voucherNo,
            'voucher_date' => '2026-05-10',
            'source_warehouse_id' => $sourceWarehouse->id,
            'merchant_id' => $merchant->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_qty' => 1,
            'total_amount' => null,
            'remark' => null,
            'default_to_warehouse_id' => $destinationWarehouse->id,
            'default_to_city' => $destinationWarehouse->city,
            'default_to_address_line1' => $destinationWarehouse->address,
            'default_to_address_line2' => null,
            'default_to_township' => null,
            'default_to_region' => null,
            'default_to_postal_code' => null,
            'default_recipient_name' => null,
            'default_recipient_phone' => null,
            'total_weight' => $totalWeight,
            'created_by' => $user->id,
        ]);

        VoucherItem::query()->create([
            'organization_id' => $organization->id,
            'voucher_id' => $voucher->id,
            'line_no' => 1,
            'product_id' => $product->id,
            'description' => null,
            'from_warehouse_id' => $sourceWarehouse->id,
            'to_warehouse_id' => $destinationWarehouse->id,
            'to_city' => null,
            'to_address_line1' => null,
            'to_address_line2' => null,
            'to_township' => null,
            'to_region' => null,
            'to_postal_code' => null,
            'recipient_name' => null,
            'recipient_phone' => null,
            'qty' => 1,
            'loaded_qty' => 0,
            'delivered_qty' => 0,
            'unit' => $product->unit ?? 'piece',
            'freight_rate' => null,
            'freight_amount' => null,
            'payment_status' => 'UNPAID',
            'is_fragile' => false,
        ]);

        return $voucher;
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
            'name' => 'Trip Tester',
            'code' => 'trip_tester_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);
        $role->permissions()->sync($ids);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
