<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseStockController extends Controller
{
    public function __construct(
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $organizationId = $user->organization_id;

        $warehouses = $this->operationalContext->assignedWarehousesForStock($user)
            ->values();

        $requestedId = (int) $request->query('warehouse_id', 0);

        $warehouseId = $requestedId > 0
            ? $requestedId
            : (int) ($warehouses->first()?->id ?? 0);
        $selectedWarehouse = $warehouses->firstWhere('id', $warehouseId);
        if (! $selectedWarehouse && $warehouses->isNotEmpty()) {
            $warehouseId = (int) $warehouses->first()->id;
            $selectedWarehouse = $warehouses->first();
        }

        $stocks = collect();
        if ($selectedWarehouse) {
            $stocks = WarehouseStock::query()
                ->where('organization_id', $organizationId)
                ->where('warehouse_id', $warehouseId)
                ->where(function ($query) {
                    $query->where('qty_on_hand', '!=', 0)
                        ->orWhere('qty_reserved', '!=', 0);
                })
                ->with('product:id,name,unit,sku')
                ->orderBy('id')
                ->get(['id', 'warehouse_id', 'product_id', 'qty_on_hand', 'qty_reserved', 'updated_at']);
        }

        $products = Product::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'ACTIVE')
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'sku']);

        return Inertia::render('Admin/Inventory/WarehouseStocksIndex', [
            'warehouses' => $warehouses,
            'selectedWarehouseId' => $selectedWarehouse?->id,
            'stocks' => $stocks,
            'products' => $products,
        ]);
    }

    public function adjust(Request $request): RedirectResponse
    {
        $actor = $request->user();
        abort_if(! $actor->hasPermission('inventory.manage'), 403);

        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'qty' => ['required', 'numeric', 'not_in:0'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $warehouse = Warehouse::query()
            ->where('organization_id', $organizationId)
            ->whereKey($validated['warehouse_id'])
            ->firstOrFail();

        $allowedStockIds = $this->operationalContext->assignedWarehousesForStock($actor)->pluck('id')->map(fn ($id) => (int) $id)->all();
        abort_unless(in_array((int) $warehouse->id, $allowedStockIds, true), 403);

        abort_unless($actor->canAccessWarehouse($warehouse, 'OPERATE'), 403);

        $product = Product::query()
            ->where('organization_id', $organizationId)
            ->whereKey($validated['product_id'])
            ->firstOrFail();

        $delta = (float) $validated['qty'];

        DB::transaction(function () use ($organizationId, $warehouse, $product, $delta, $validated, $actor) {
            $stock = WarehouseStock::query()
                ->where('organization_id', $organizationId)
                ->where('warehouse_id', $warehouse->id)
                ->where('product_id', $product->id)
                ->lockForUpdate()
                ->first();

            if (! $stock) {
                WarehouseStock::query()->create([
                    'organization_id' => $organizationId,
                    'warehouse_id' => $warehouse->id,
                    'product_id' => $product->id,
                    'qty_on_hand' => 0,
                    'qty_reserved' => 0,
                ]);
                $stock = WarehouseStock::query()
                    ->where('organization_id', $organizationId)
                    ->where('warehouse_id', $warehouse->id)
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            $newOnHand = (float) $stock->qty_on_hand + $delta;
            if ($newOnHand < 0) {
                throw ValidationException::withMessages([
                    'qty' => 'Adjustment would make on-hand quantity negative.',
                ]);
            }

            $stock->qty_on_hand = $newOnHand;
            $stock->save();

            StockMovement::query()->create([
                'organization_id' => $organizationId,
                'movement_no' => $this->uniqueMovementNo($organizationId),
                'movement_type' => 'ADJUSTMENT',
                'warehouse_id' => $warehouse->id,
                'product_id' => $product->id,
                'qty' => $delta,
                'unit' => $product->unit,
                'ref_type' => 'ADJUSTMENT',
                'ref_id' => null,
                'note' => $validated['note'] ?? null,
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);
        });

        AuditLogger::record($actor, 'stock.adjustment', null, [
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'qty' => $delta,
        ]);

        return Redirect::route('admin.stocks.index', ['warehouse_id' => $warehouse->id])
            ->with('success', 'Stock adjusted successfully.');
    }

    private function uniqueMovementNo(int $organizationId): string
    {
        do {
            $no = 'MV-'.Str::upper(Str::ulid());
        } while (StockMovement::query()->where('organization_id', $organizationId)->where('movement_no', $no)->exists());

        return $no;
    }
}
