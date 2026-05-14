<?php

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\DeliveryConfirmation;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\VoucherItem;
use App\Models\WarehouseStock;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Links voucher confirmation and trip/delivery flows to warehouse_stocks + stock_movements.
 *
 * Quantities on movements are signed: positive increases on-hand at the movement's warehouse_id,
 * negative decreases (e.g. LOAD outbound from source).
 */
class StockLedgerService
{
    public function recordIntakeForVoucherItem(VoucherItem $vi, User $actor): void
    {
        $qty = round((float) $vi->qty, 3);
        if ($qty < 0.0001) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: (int) $vi->from_warehouse_id,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: $qty,
            movementType: 'INTAKE',
            refType: 'VOUCHER_ITEM',
            refId: (int) $vi->id,
            actor: $actor,
            note: null,
        );
    }

    /**
     * Goods leave the source warehouse onto the trip (outbound).
     */
    public function applyTripLoadOutbound(VoucherItem $vi, float $qtyLeaving, int $tripItemId, User $actor, ?string $note = null): void
    {
        $qtyLeaving = round($qtyLeaving, 3);
        if ($qtyLeaving < 0.0001) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: (int) $vi->from_warehouse_id,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: -$qtyLeaving,
            movementType: 'LOAD',
            refType: 'TRIP_ITEM',
            refId: $tripItemId,
            actor: $actor,
            note: $note,
        );
    }

    /**
     * Loaded quantity removed from trip before delivery: goods return to source warehouse on-hand.
     */
    public function applyTripLoadReturnToWarehouse(VoucherItem $vi, float $qtyReturning, int $tripItemId, User $actor, ?string $note = null): void
    {
        $qtyReturning = round($qtyReturning, 3);
        if ($qtyReturning < 0.0001) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: (int) $vi->from_warehouse_id,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: $qtyReturning,
            movementType: 'LOAD',
            refType: 'TRIP_ITEM',
            refId: $tripItemId,
            actor: $actor,
            note: $note,
        );
    }

    /**
     * Receiver warehouse inbound when a destination warehouse is resolved (e.g. trip stop or voucher default destination).
     *
     * @param  int|null  $receivingWarehouseId  Resolved warehouse.
     */
    public function applyInboundDelivery(VoucherItem $vi, float $receivedQty, int $deliveryConfirmationId, User $actor, ?string $note = null, ?int $receivingWarehouseId = null): void
    {
        $receivedQty = round($receivedQty, 3);
        $warehouseId = $receivingWarehouseId;
        if ($receivedQty < 0.0001 || $warehouseId === null) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: $warehouseId,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: $receivedQty,
            movementType: 'TRANSFER_IN',
            refType: 'DELIVERY_CONFIRMATION',
            refId: $deliveryConfirmationId,
            actor: $actor,
            note: $note,
        );
    }

    /**
     * Destination-warehouse receipt step: post TRANSFER_IN exactly once per delivery confirmation.
     *
     * @param  int|null  $receivingWarehouseId  Resolved warehouse.
     */
    public function applyInboundForDeliveryConfirmation(DeliveryConfirmation $confirmation, VoucherItem $vi, User $actor, ?string $note = null, ?int $receivingWarehouseId = null): bool
    {
        $receivedQty = round((float) $confirmation->received_qty, 3);
        $warehouseId = $receivingWarehouseId;
        if ($receivedQty < 0.0001 || $warehouseId === null) {
            return false;
        }

        $alreadyPosted = StockMovement::query()
            ->where('organization_id', $vi->organization_id)
            ->where('movement_type', 'TRANSFER_IN')
            ->where('ref_type', 'DELIVERY_CONFIRMATION')
            ->where('ref_id', $confirmation->id)
            ->exists();

        if ($alreadyPosted) {
            return false;
        }

        $this->applyInboundDelivery(
            vi: $vi,
            receivedQty: $receivedQty,
            deliveryConfirmationId: (int) $confirmation->id,
            actor: $actor,
            note: $note,
            receivingWarehouseId: $warehouseId
        );

        return true;
    }

    /**
     * Dispatch from a warehouse after it has received goods (owner pickup/direct delivery/forward).
     */
    public function applyWarehouseDispatch(
        VoucherItem $vi,
        int $warehouseId,
        float $qtyLeaving,
        string $movementType,
        string $refType,
        int $refId,
        User $actor,
        ?string $note = null
    ): void {
        $qtyLeaving = round($qtyLeaving, 3);
        if ($qtyLeaving < 0.0001) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: $warehouseId,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: -$qtyLeaving,
            movementType: $movementType,
            refType: $refType,
            refId: $refId,
            actor: $actor,
            note: $note,
        );
    }

    /**
     * Explicit transfer-in into a warehouse for forwarded goods.
     */
    public function applyWarehouseTransferIn(
        VoucherItem $vi,
        int $warehouseId,
        float $qtyIn,
        string $refType,
        int $refId,
        User $actor,
        ?string $note = null
    ): void {
        $qtyIn = round($qtyIn, 3);
        if ($qtyIn < 0.0001) {
            return;
        }

        $unit = $this->resolveUnit($vi);
        $this->applySignedMovement(
            organizationId: (int) $vi->organization_id,
            warehouseId: $warehouseId,
            productId: (int) $vi->product_id,
            unit: $unit,
            qtySigned: $qtyIn,
            movementType: 'TRANSFER_IN',
            refType: $refType,
            refId: $refId,
            actor: $actor,
            note: $note,
        );
    }

    private function resolveUnit(VoucherItem $vi): string
    {
        $product = Product::query()
            ->whereKey($vi->product_id)
            ->where('organization_id', $vi->organization_id)
            ->firstOrFail();

        $u = trim((string) ($vi->unit ?? ''));
        if ($u !== '') {
            return $u;
        }

        return (string) ($product->unit ?? 'piece');
    }

    private function applySignedMovement(
        int $organizationId,
        int $warehouseId,
        int $productId,
        string $unit,
        float $qtySigned,
        string $movementType,
        string $refType,
        int $refId,
        User $actor,
        ?string $note,
    ): void {
        if (abs($qtySigned) < 0.0001) {
            return;
        }

        $stock = WarehouseStock::query()
            ->where('organization_id', $organizationId)
            ->where('warehouse_id', $warehouseId)
            ->where('product_id', $productId)
            ->lockForUpdate()
            ->first();

        if (! $stock) {
            WarehouseStock::query()->create([
                'organization_id' => $organizationId,
                'warehouse_id' => $warehouseId,
                'product_id' => $productId,
                'qty_on_hand' => 0,
                'qty_reserved' => 0,
            ]);
            $stock = WarehouseStock::query()
                ->where('organization_id', $organizationId)
                ->where('warehouse_id', $warehouseId)
                ->where('product_id', $productId)
                ->lockForUpdate()
                ->firstOrFail();
        }

        $newOnHand = round((float) $stock->qty_on_hand + $qtySigned, 3);
        if ($newOnHand < -0.0001) {
            throw ValidationException::withMessages([
                'loaded_qty' => [
                    'Insufficient stock at source warehouse for this load (available '
                        .number_format(max(0, (float) $stock->qty_on_hand), 3, '.', '').' '.$unit.').',
                ],
            ]);
        }

        $stock->qty_on_hand = $newOnHand;
        $stock->save();

        StockMovement::query()->create([
            'organization_id' => $organizationId,
            'movement_no' => $this->uniqueMovementNo($organizationId),
            'movement_type' => $movementType,
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'qty' => $qtySigned,
            'unit' => $unit,
            'ref_type' => $refType,
            'ref_id' => $refId,
            'note' => $note,
            'created_by' => $actor->id,
            'created_at' => now(),
        ]);
    }

    private function uniqueMovementNo(int $organizationId): string
    {
        do {
            $no = 'MV-'.Str::upper(Str::ulid());
        } while (StockMovement::query()->where('organization_id', $organizationId)->where('movement_no', $no)->exists());

        return $no;
    }
}
