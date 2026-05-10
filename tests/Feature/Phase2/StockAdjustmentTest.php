<?php

namespace Tests\Feature\Phase2;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_positive_adjustment_creates_stock_and_movement(): void
    {
        [$organization, $user] = $this->createTenantUser();
        $this->grantPermission($user, 'inventory.manage');
        $this->grantPermission($user, 'warehouses.manage');

        $warehouse = Warehouse::factory()->create(['organization_id' => $organization->id]);
        $product = Product::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($user)->post(route('admin.stocks.adjust'), [
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'qty' => 7.5,
            'note' => 'Opening count',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('warehouse_stocks', [
            'organization_id' => $organization->id,
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
        ]);

        $stock = WarehouseStock::query()
            ->where('organization_id', $organization->id)
            ->where('warehouse_id', $warehouse->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($stock);
        $this->assertEquals(7.5, (float) $stock->qty_on_hand);
    }

    public function test_negative_adjustment_rejects_when_insufficient_on_hand(): void
    {
        [$organization, $user] = $this->createTenantUser();
        $this->grantPermission($user, 'inventory.manage');
        $this->grantPermission($user, 'warehouses.manage');

        $warehouse = Warehouse::factory()->create(['organization_id' => $organization->id]);
        $product = Product::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'ACTIVE',
        ]);

        WarehouseStock::query()->create([
            'organization_id' => $organization->id,
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'qty_on_hand' => 2,
            'qty_reserved' => 0,
        ]);

        $response = $this->actingAs($user)->post(route('admin.stocks.adjust'), [
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'qty' => -5,
        ]);

        $response->assertSessionHasErrors('qty');
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
            ['name' => $permissionCode, 'module' => str_contains($permissionCode, 'warehouse') ? 'warehouse' : 'inventory']
        );

        $role = Role::query()->create([
            'organization_id' => $user->organization_id,
            'name' => 'Test Role',
            'code' => 'test_role_'.mt_rand(1000, 9999),
            'is_system_role' => false,
        ]);

        $role->permissions()->syncWithoutDetaching([$permission->id]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}
