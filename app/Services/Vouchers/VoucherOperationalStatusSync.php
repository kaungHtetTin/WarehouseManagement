<?php

namespace App\Services\Vouchers;

use App\Models\TripItem;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Derives voucher.status from loaded/delivered quantities and related trip states.
 * Does not alter DRAFT, CANCELLED, or CLOSED vouchers.
 */
class VoucherOperationalStatusSync
{
    private const EPS = 0.0001;

    /**
     * @param  array<int>  $voucherIds
     */
    public function syncForVoucherIds(int $organizationId, array $voucherIds, ?User $actor = null): void
    {
        foreach (array_unique(array_filter($voucherIds)) as $vid) {
            $this->syncVoucher($organizationId, (int) $vid, $actor);
        }
    }

    public function syncForTrip(int $organizationId, int $tripId, ?User $actor = null): void
    {
        $voucherIds = TripItem::query()
            ->where('organization_id', $organizationId)
            ->where('trip_id', $tripId)
            ->with('voucherItem:id,voucher_id')
            ->get()
            ->pluck('voucherItem.voucher_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $this->syncForVoucherIds($organizationId, $voucherIds, $actor);
    }

    private function syncVoucher(int $organizationId, int $voucherId, ?User $actor): void
    {
        DB::transaction(function () use ($organizationId, $voucherId, $actor) {
            $voucher = Voucher::query()
                ->where('organization_id', $organizationId)
                ->whereKey($voucherId)
                ->lockForUpdate()
                ->first();

            if ($voucher === null || in_array($voucher->status, ['DRAFT', 'CANCELLED', 'CLOSED'], true)) {
                return;
            }

            $items = VoucherItem::query()
                ->where('voucher_id', $voucherId)
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->get();

            if ($items->isEmpty()) {
                return;
            }

            $newStatus = $this->computeTargetStatus($organizationId, $items);

            if ($newStatus === null || $voucher->status === $newStatus) {
                return;
            }

            $from = $voucher->status;
            $voucher->status = $newStatus;
            $voucher->save();

            AuditLogger::record($actor, 'voucher.status_transition', $voucher, [
                'voucher_no' => $voucher->voucher_no,
                'status_from' => $from,
                'status_to' => $newStatus,
            ]);
        });
    }

    /**
     * @param  \Illuminate\Support\Collection<int, VoucherItem>  $items
     */
    private function computeTargetStatus(int $organizationId, $items): ?string
    {
        $allDelivered = true;
        $anyDelivered = false;

        foreach ($items as $vi) {
            $q = (float) $vi->qty;
            $d = (float) $vi->delivered_qty;
            if ($d < $q - self::EPS) {
                $allDelivered = false;
            }
            if ($d > self::EPS) {
                $anyDelivered = true;
            }
        }

        if ($allDelivered) {
            return 'DELIVERED';
        }

        if ($anyDelivered) {
            return 'PARTIALLY_DELIVERED';
        }

        $voucherItemIds = $items->pluck('id')->all();

        $hasInTransitCargo = TripItem::query()
            ->where('organization_id', $organizationId)
            ->whereIn('voucher_item_id', $voucherItemIds)
            ->whereHas('trip', fn ($q) => $q->whereIn('status', ['DEPARTED', 'AT_STOP']))
            ->get()
            ->contains(function (TripItem $ti) {
                return ((float) $ti->loaded_qty - (float) $ti->delivered_qty) > self::EPS;
            });

        if ($hasInTransitCargo) {
            return 'IN_TRANSIT';
        }

        $totalLoaded = (float) $items->sum(fn (VoucherItem $vi) => (float) $vi->loaded_qty);

        if ($totalLoaded > self::EPS) {
            return 'LOADING';
        }

        return 'CONFIRMED';
    }
}
