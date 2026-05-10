<?php

namespace Tests\Feature\Phase3;

use App\Models\DeliveryConfirmation;
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
use App\Models\WarehouseFulfillmentInstruction;
use App\Models\WarehouseStock;
use App\Services\Inventory\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TripManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_trip_with_ordered_stops(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $stopWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user)->post(route('admin.trips.store'), [
            'vehicle_id' => $vehicle->id,
            'vehicle' => $this->tripVehiclePayloadFromModel($vehicle),
            'source_warehouse_id' => $sourceWh->id,
            'driver_name' => 'U Driver',
            'driver_phone' => '091234567',
            'stops' => [
                [
                    'warehouse_id' => $stopWh->id,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                ],
                [
                    'warehouse_id' => null,
                    'location_name' => 'Customer dock',
                    'city' => 'Mandalay',
                    'address' => 'Street 2',
                ],
            ],
        ]);

        $trip = Trip::query()->where('organization_id', $user->organization_id)->first();
        $this->assertNotNull($trip);
        $response->assertRedirect(route('admin.trips.show', $trip));

        $this->assertSame('PLANNED', $trip->status);
        $this->assertStringStartsWith('T-', $trip->trip_no);
        $this->assertSame(2, $trip->stops()->count());
        $this->assertSame($stopWh->id, $trip->stops()->where('stop_order', 1)->first()->warehouse_id);
        $this->assertSame('Mandalay', $trip->stops()->where('stop_order', 2)->first()->city);
    }

    public function test_trip_store_requires_meaningful_stop(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();

        $response = $this->actingAs($user)->post(route('admin.trips.store'), [
            'vehicle_id' => $vehicle->id,
            'vehicle' => $this->tripVehiclePayloadFromModel($vehicle),
            'source_warehouse_id' => $sourceWh->id,
            'stops' => [
                [
                    'warehouse_id' => null,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                ],
            ],
        ]);

        $response->assertSessionHasErrors('stops.0');
        $this->assertSame(0, Trip::query()->where('organization_id', $user->organization_id)->count());
    }

    public function test_create_trip_without_vehicle_id_creates_new_vehicle(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $stopWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);

        $countBefore = Vehicle::query()->where('organization_id', $user->organization_id)->count();

        $response = $this->actingAs($user)->post(route('admin.trips.store'), [
            'vehicle_id' => null,
            'vehicle' => [
                'vehicle_no' => 'NEW-TRIP-VH-01',
                'vehicle_type' => 'TRUCK',
                'warehouse_id' => null,
                'capacity_weight' => null,
                'capacity_volume' => null,
            ],
            'source_warehouse_id' => $sourceWh->id,
            'stops' => [
                [
                    'warehouse_id' => $stopWh->id,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                ],
            ],
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();
        $this->assertSame($countBefore + 1, Vehicle::query()->where('organization_id', $user->organization_id)->count());

        $created = Vehicle::query()->where('organization_id', $user->organization_id)->where('vehicle_no', 'NEW-TRIP-VH-01')->first();
        $this->assertNotNull($created);
        $trip = Trip::query()->where('organization_id', $user->organization_id)->latest('id')->first();
        $this->assertSame($created->id, $trip->vehicle_id);
    }

    public function test_vehicle_search_returns_json_matches(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();

        $response = $this->actingAs($user)->getJson(route('admin.trips.wizard.vehicle-search', ['q' => 'TRIP-TEST']));

        $response->assertOk();
        $response->assertJsonPath('results.0.id', $vehicle->id);
    }

    public function test_cannot_view_foreign_organization_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $trip = Trip::query()->create([
            'organization_id' => $user->organization_id,
            'trip_no' => 'T-TESTFOREIGN01',
            'vehicle_id' => $vehicle->id,
            'source_warehouse_id' => $sourceWh->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);

        $intruder = User::factory()->create([
            'organization_id' => Organization::factory()->create()->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantTripPermissions($intruder, view: true, manage: false);

        $response = $this->actingAs($intruder)->get(route('admin.trips.show', $trip));

        $response->assertNotFound();
    }

    public function test_can_view_trip_manifest(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);

        $response = $this->actingAs($user)->get(route('admin.trips.manifest', $trip));

        $response->assertOk();
        $response->assertSee($trip->trip_no, false);
        $response->assertSee('Driver manifest', false);
    }

    public function test_cannot_view_foreign_organization_manifest(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $trip = Trip::query()->create([
            'organization_id' => $user->organization_id,
            'trip_no' => 'T-MANIFEST-FOREIGN',
            'vehicle_id' => $vehicle->id,
            'source_warehouse_id' => $sourceWh->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);

        $intruder = User::factory()->create([
            'organization_id' => Organization::factory()->create()->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantTripPermissions($intruder, view: true, manage: false);

        $response = $this->actingAs($intruder)->get(route('admin.trips.manifest', $trip));

        $response->assertNotFound();
    }

    public function test_can_mark_manifest_printed(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $this->assertNull($trip->fresh()->manifest_printed_at);

        $response = $this->actingAs($user)->post(route('admin.trips.manifest-printed', $trip));

        $response->assertRedirect(route('admin.trips.manifest', $trip));
        $this->assertNotNull($trip->fresh()->manifest_printed_at);
    }

    public function test_can_load_confirmed_voucher_line_onto_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');

        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 4,
            'trip_stop_id' => null,
        ]);

        $response->assertRedirect(route('admin.trips.show', $trip));
        $this->assertSame(1, TripItem::query()->where('trip_id', $trip->id)->count());
        $row = TripItem::query()->where('trip_id', $trip->id)->first();
        $this->assertSame('4.000', (string) $row->loaded_qty);
        $line->refresh();
        $this->assertSame('4.000', (string) $line->loaded_qty);
        $this->assertSame('LOADING', Voucher::query()->find($line->voucher_id)->status);
    }

    public function test_voucher_status_advances_with_trip_departure_and_delivery(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $voucherId = $line->voucher_id;

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $this->assertSame('LOADING', Voucher::query()->find($voucherId)->status);

        $trip->update(['status' => 'DEPARTED']);
        $this->assertSame('IN_TRANSIT', Voucher::query()->find($voucherId)->status);

        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);
        $this->assertSame('DELIVERED', Voucher::query()->find($voucherId)->status);
    }

    public function test_merge_same_voucher_line_on_same_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 3,
        ]);
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 2,
        ]);

        $this->assertSame(1, TripItem::query()->where('trip_id', $trip->id)->count());
        $this->assertSame('5.000', (string) TripItem::query()->where('trip_id', $trip->id)->first()->loaded_qty);
    }

    public function test_same_voucher_line_different_stops_creates_separate_trip_items(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $trip = Trip::query()->create([
            'organization_id' => $user->organization_id,
            'trip_no' => 'T-'.strtoupper(Str::ulid()),
            'vehicle_id' => $vehicle->id,
            'source_warehouse_id' => $sourceWh->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);
        $stop1 = TripStop::query()->create([
            'organization_id' => $user->organization_id,
            'trip_id' => $trip->id,
            'stop_order' => 1,
            'warehouse_id' => null,
            'location_name' => 'Stop A',
            'city' => 'Yangon',
            'address' => 'Addr A',
            'status' => 'PENDING',
        ]);
        $stop2 = TripStop::query()->create([
            'organization_id' => $user->organization_id,
            'trip_id' => $trip->id,
            'stop_order' => 2,
            'warehouse_id' => null,
            'location_name' => 'Stop B',
            'city' => 'Mandalay',
            'address' => 'Addr B',
            'status' => 'PENDING',
        ]);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '20.000');

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop1->id,
        ]);
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop2->id,
        ]);

        $this->assertSame(2, TripItem::query()->where('trip_id', $trip->id)->count());
        $this->assertSame(
            '10.000',
            (string) TripItem::query()->where('trip_id', $trip->id)->where('trip_stop_id', $stop1->id)->value('loaded_qty')
        );
        $this->assertSame(
            '10.000',
            (string) TripItem::query()->where('trip_id', $trip->id)->where('trip_stop_id', $stop2->id)->value('loaded_qty')
        );
        $line->refresh();
        $this->assertSame('20.000', (string) $line->loaded_qty);
    }

    public function test_cannot_exceed_remaining_qty_across_trips(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$tripA] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        [$tripB] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');

        $this->actingAs($user)->post(route('admin.trips.items.store', $tripA), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 6,
        ]);
        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $tripB), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 5,
        ]);

        $response->assertSessionHasErrors('loaded_qty');
        $this->assertSame('6.000', (string) $line->fresh()->loaded_qty);
    }

    public function test_rejects_line_from_different_source_warehouse(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $otherWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $line = $this->confirmedVoucherLine($user, $otherWh, qty: '10.000');

        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 1,
        ]);

        $response->assertSessionHasErrors('voucher_item_id');
        $this->assertSame(0, TripItem::query()->count());
    }

    public function test_rejects_draft_voucher_line(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000', voucherStatus: 'DRAFT');

        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 1,
        ]);

        $response->assertSessionHasErrors('voucher_item_id');
        $this->assertSame(0, TripItem::query()->count());
    }

    public function test_can_load_cargo_onto_departed_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $trip->update(['status' => 'DEPARTED']);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');

        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 1,
        ]);

        $response->assertRedirect(route('admin.trips.show', $trip));
        $this->assertSame(1, TripItem::query()->where('trip_id', $trip->id)->count());
    }

    public function test_cannot_post_items_to_foreign_organization_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');

        $intruder = User::factory()->create([
            'organization_id' => Organization::factory()->create()->id,
            'status' => 'ACTIVE',
        ]);
        $this->grantTripPermissions($intruder, view: true, manage: true);

        $response = $this->actingAs($intruder)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 1,
        ]);

        $response->assertNotFound();
        $this->assertSame(0, TripItem::query()->count());
    }

    public function test_can_sync_stops_adds_new_stop(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $stopWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user)->put(route('admin.trips.stops.sync', $trip), [
            'stops' => [
                [
                    'id' => $stop->id,
                    'warehouse_id' => null,
                    'location_name' => $stop->location_name,
                    'city' => $stop->city,
                    'address' => $stop->address,
                ],
                [
                    'warehouse_id' => $stopWh->id,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                ],
            ],
        ]);

        $response->assertRedirect(route('admin.trips.show', $trip));
        $rows = TripStop::query()->where('trip_id', $trip->id)->orderBy('stop_order')->get();
        $this->assertCount(2, $rows);
        $this->assertSame(1, (int) $rows[0]->stop_order);
        $this->assertSame(2, (int) $rows[1]->stop_order);
        $this->assertSame($stopWh->id, (int) $rows[1]->warehouse_id);
    }

    public function test_sync_stops_rejects_removing_stop_with_cargo(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 2,
            'trip_stop_id' => $stop->id,
        ]);
        $wh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $response = $this->actingAs($user)->put(route('admin.trips.stops.sync', $trip), [
            'stops' => [
                [
                    'warehouse_id' => $wh->id,
                    'location_name' => null,
                    'city' => null,
                    'address' => null,
                ],
            ],
        ]);
        $response->assertSessionHasErrors('stops');
        $this->assertSame(1, TripStop::query()->where('trip_id', $trip->id)->count());
    }

    public function test_can_patch_trip_item_qty(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 4,
        ]);
        $item = TripItem::query()->where('trip_id', $trip->id)->firstOrFail();

        $response = $this->actingAs($user)->patch(route('admin.trips.items.update', [$trip, $item]), [
            'loaded_qty' => 7,
            'trip_stop_id' => null,
        ]);

        $response->assertRedirect(route('admin.trips.show', $trip));
        $this->assertSame('7.000', (string) $item->fresh()->loaded_qty);
        $this->assertSame('7.000', (string) $line->fresh()->loaded_qty);
    }

    public function test_can_delete_trip_item(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 4,
        ]);
        $item = TripItem::query()->where('trip_id', $trip->id)->firstOrFail();

        $response = $this->actingAs($user)->delete(route('admin.trips.items.destroy', [$trip, $item]));

        $response->assertRedirect(route('admin.trips.show', $trip));
        $this->assertSame(0, TripItem::query()->where('trip_id', $trip->id)->count());
        $this->assertSame('0.000', (string) $line->fresh()->loaded_qty);
    }

    public function test_confirm_trip_delivery_records_all_remaining_lines(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $lineA = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $lineB = $this->confirmedVoucherLine($user, $sourceWh, qty: '8.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $lineA->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $lineB->id,
            'loaded_qty' => 8,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);

        $response = $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), [
            'note' => 'All drops OK',
        ]);

        $response->assertRedirect(route('admin.trips.show', $trip));
        $this->assertSame(2, TripItem::query()->where('trip_id', $trip->id)->where('status', 'DELIVERED')->count());
        $this->assertSame(2, DeliveryConfirmation::query()->whereIn('trip_item_id', TripItem::query()->where('trip_id', $trip->id)->pluck('id'))->count());
        $this->assertSame('10.000', (string) $lineA->fresh()->delivered_qty);
        $this->assertSame('8.000', (string) $lineB->fresh()->delivered_qty);
    }

    public function test_confirm_trip_delivery_single_cargo_line(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 5,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'AT_STOP']);

        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $item = TripItem::query()->where('trip_id', $trip->id)->firstOrFail();
        $this->assertSame('5.000', (string) $item->delivered_qty);
        $this->assertSame('DELIVERED', $item->status);
        $this->assertSame('5.000', (string) $line->fresh()->delivered_qty);
    }

    public function test_confirm_single_trip_item_partial_delivery(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);
        $item = TripItem::query()->where('trip_id', $trip->id)->firstOrFail();

        $response = $this->actingAs($user)->post(
            route('admin.trips.items.delivery-confirmations.store', [$trip, $item]),
            [
                'received_qty' => 4,
                'delivery_status' => 'PARTIAL',
                'note' => 'First drop',
            ]
        );

        $response->assertRedirect(route('admin.trips.show', $trip));
        $item->refresh();
        $this->assertSame('4.000', (string) $item->delivered_qty);
        $this->assertSame('PARTIALLY_DELIVERED', $item->status);
        $this->assertSame('4.000', (string) $line->fresh()->delivered_qty);
        $this->assertSame(1, DeliveryConfirmation::query()->where('trip_item_id', $item->id)->count());
        $this->assertSame('PARTIALLY_DELIVERED', Voucher::query()->find($line->voucher_id)->status);
    }

    public function test_cannot_load_cargo_when_insufficient_stock_at_source(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '3.000');

        $response = $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 5,
            'trip_stop_id' => $stop->id,
        ]);

        $response->assertSessionHasErrors('loaded_qty');
    }

    public function test_delivery_to_destination_warehouse_posts_stock_and_creates_fulfillment_instruction(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $destWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000', voucherStatus: 'CONFIRMED', toWarehouse: $destWh);

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);

        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $stockAfterDelivery = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $destWh->id)
            ->where('product_id', $line->product_id)
            ->first();

        $this->assertNotNull($stockAfterDelivery);
        $this->assertSame('10.000', (string) $stockAfterDelivery->qty_on_hand);

        $instruction = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $user->organization_id)
            ->where('voucher_item_id', $line->id)
            ->where('warehouse_id', $destWh->id)
            ->first();
        $this->assertNotNull($instruction);
        $this->assertSame('10.000', (string) $instruction->qty_received);
        $this->assertSame('0.000', (string) $instruction->qty_dispatched);
        $this->assertSame('PENDING_ACTION', $instruction->status);
    }

    public function test_delivery_posts_stock_to_trip_stop_warehouse_without_voucher_to_warehouse(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $stopWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $stop->update(['warehouse_id' => $stopWh->id]);

        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000', voucherStatus: 'CONFIRMED', toWarehouse: null);

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);
        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $stock = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $stopWh->id)
            ->where('product_id', $line->product_id)
            ->first();
        $this->assertNotNull($stock);
        $this->assertSame('10.000', (string) $stock->qty_on_hand);

        $instruction = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $user->organization_id)
            ->where('voucher_item_id', $line->id)
            ->where('warehouse_id', $stopWh->id)
            ->first();
        $this->assertNotNull($instruction);
        $this->assertSame('10.000', (string) $instruction->qty_received);
    }

    public function test_receiving_warehouse_prefers_trip_stop_over_voucher_to_warehouse(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $stopWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $voucherDestWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $stop->update(['warehouse_id' => $stopWh->id]);

        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000', voucherStatus: 'CONFIRMED', toWarehouse: $voucherDestWh);

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);
        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $stockStop = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $stopWh->id)
            ->where('product_id', $line->product_id)
            ->first();
        $this->assertNotNull($stockStop);
        $this->assertSame('10.000', (string) $stockStop->qty_on_hand);

        $stockVoucherDest = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $voucherDestWh->id)
            ->where('product_id', $line->product_id)
            ->first();
        $this->assertNull($stockVoucherDest);
    }

    public function test_destination_warehouse_can_forward_goods_to_another_warehouse(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        $destWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $nextWh = Warehouse::factory()->create([
            'organization_id' => $user->organization_id,
            'status' => 'ACTIVE',
        ]);
        $user->warehouses()->syncWithoutDetaching([
            $destWh->id => ['access_level' => 'OPERATE'],
            $nextWh->id => ['access_level' => 'OPERATE'],
        ]);
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000', voucherStatus: 'CONFIRMED', toWarehouse: $destWh);

        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 10,
            'trip_stop_id' => $stop->id,
        ]);
        $trip->update(['status' => 'DEPARTED']);
        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $instruction = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $user->organization_id)
            ->where('voucher_item_id', $line->id)
            ->where('warehouse_id', $destWh->id)
            ->firstOrFail();

        $response = $this->actingAs($user)->post(route('admin.fulfillment.instructions.dispatch', $instruction), [
            'action_type' => 'FORWARD_TO_WAREHOUSE',
            'qty' => 4,
            'next_warehouse_id' => $nextWh->id,
        ]);
        $response->assertSessionHasNoErrors();

        $destStock = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $destWh->id)
            ->where('product_id', $line->product_id)
            ->firstOrFail();
        $this->assertSame('6.000', (string) $destStock->qty_on_hand);

        $nextStock = WarehouseStock::query()
            ->where('organization_id', $user->organization_id)
            ->where('warehouse_id', $nextWh->id)
            ->where('product_id', $line->product_id)
            ->firstOrFail();
        $this->assertSame('4.000', (string) $nextStock->qty_on_hand);

        $instruction->refresh();
        $this->assertSame('4.000', (string) $instruction->qty_dispatched);
        $this->assertSame('PENDING_ACTION', $instruction->status);

        $nextInstruction = WarehouseFulfillmentInstruction::query()
            ->where('organization_id', $user->organization_id)
            ->where('voucher_item_id', $line->id)
            ->where('warehouse_id', $nextWh->id)
            ->first();
        $this->assertNotNull($nextInstruction);
        $this->assertSame('4.000', (string) $nextInstruction->qty_received);
        $this->assertSame('PENDING_ACTION', $nextInstruction->status);
    }

    public function test_confirm_trip_delivery_empty_remaining_fails(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip, $stop] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 5,
            'trip_stop_id' => $stop->id,
        ]);
        $item = TripItem::query()->where('trip_id', $trip->id)->firstOrFail();
        $trip->update(['status' => 'DEPARTED']);
        $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);
        $item->refresh();
        $this->assertSame('DELIVERED', $item->status);

        $response = $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $response->assertSessionHasErrors('note');
    }

    public function test_cannot_record_delivery_on_completed_trip(): void
    {
        [$user, $sourceWh, $vehicle] = $this->tripActorFixtures();
        [$trip] = $this->plannedTripWithStop($user, $sourceWh, $vehicle);
        $line = $this->confirmedVoucherLine($user, $sourceWh, qty: '10.000');
        $this->actingAs($user)->post(route('admin.trips.items.store', $trip), [
            'voucher_item_id' => $line->id,
            'loaded_qty' => 1,
        ]);
        $trip->update(['status' => 'COMPLETED']);

        $response = $this->actingAs($user)->post(route('admin.trips.delivery-confirmations.store', $trip), []);

        $response->assertSessionHasErrors('note');
    }

    /**
     * @return array{0: Trip, 1: TripStop}
     */
    private function plannedTripWithStop(User $user, Warehouse $sourceWh, Vehicle $vehicle): array
    {
        $trip = Trip::query()->create([
            'organization_id' => $user->organization_id,
            'trip_no' => 'T-'.strtoupper(Str::ulid()),
            'vehicle_id' => $vehicle->id,
            'source_warehouse_id' => $sourceWh->id,
            'status' => 'PLANNED',
            'created_by' => $user->id,
        ]);
        $stop = TripStop::query()->create([
            'organization_id' => $user->organization_id,
            'trip_id' => $trip->id,
            'stop_order' => 1,
            'warehouse_id' => null,
            'location_name' => 'Customer',
            'city' => 'Test City',
            'address' => 'Addr 1',
            'status' => 'PENDING',
        ]);

        return [$trip, $stop];
    }

    private function confirmedVoucherLine(User $user, Warehouse $fromWarehouse, string $qty = '10.000', string $voucherStatus = 'CONFIRMED', ?Warehouse $toWarehouse = null): VoucherItem
    {
        $merchant = Merchant::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'VM Test Merchant',
        ]);
        $product = Product::factory()->create([
            'organization_id' => $user->organization_id,
        ]);
        $voucher = Voucher::query()->create([
            'organization_id' => $user->organization_id,
            'voucher_no' => 'V-'.strtoupper(Str::ulid()),
            'voucher_date' => now()->toDateString(),
            'source_warehouse_id' => $fromWarehouse->id,
            'merchant_id' => $merchant->id,
            'status' => $voucherStatus,
            'payment_status' => 'UNPAID',
            'total_qty' => $qty,
            'total_amount' => null,
            'created_by' => $user->id,
        ]);

        $line = VoucherItem::query()->create([
            'organization_id' => $user->organization_id,
            'voucher_id' => $voucher->id,
            'line_no' => 1,
            'product_id' => $product->id,
            'description' => null,
            'from_warehouse_id' => $fromWarehouse->id,
            'to_warehouse_id' => $toWarehouse !== null ? $toWarehouse->id : null,
            'to_city' => null,
            'qty' => $qty,
            'loaded_qty' => 0,
            'delivered_qty' => 0,
            'unit' => 'piece',
            'freight_rate' => null,
            'freight_amount' => null,
            'payment_status' => 'UNPAID',
            'is_fragile' => false,
        ]);

        if ($voucherStatus === 'CONFIRMED') {
            app(StockLedgerService::class)->recordIntakeForVoucherItem($line, $user);
        }

        return $line;
    }

    /**
     * @return array{0: User, 1: Warehouse, 2: Vehicle}
     */
    private function tripActorFixtures(): array
    {
        $organization = Organization::factory()->create();
        $warehouse = Warehouse::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $vehicle = Vehicle::query()->create([
            'organization_id' => $organization->id,
            'warehouse_id' => null,
            'vehicle_no' => 'TRIP-TEST-01',
            'vehicle_type' => 'TRUCK',
            'capacity_weight' => null,
            'capacity_volume' => null,
            'status' => 'ACTIVE',
        ]);
        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);
        $user->warehouses()->attach($warehouse->id, ['access_level' => 'OPERATE']);
        $this->grantTripPermissions($user, view: true, manage: true);

        return [$user, $warehouse, $vehicle];
    }

    private function grantTripPermissions(User $user, bool $view, bool $manage): void
    {
        $codes = array_values(array_filter([
            $view ? 'trips.view' : null,
            $manage ? 'trips.manage' : null,
        ]));
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

    /**
     * @return array{vehicle_no: string, vehicle_type: string, warehouse_id: int|null, capacity_weight: mixed, capacity_volume: mixed}
     */
    private function tripVehiclePayloadFromModel(Vehicle $vehicle): array
    {
        return [
            'vehicle_no' => $vehicle->vehicle_no,
            'vehicle_type' => $vehicle->vehicle_type,
            'warehouse_id' => $vehicle->warehouse_id,
            'capacity_weight' => $vehicle->capacity_weight,
            'capacity_volume' => $vehicle->capacity_volume,
        ];
    }
}
