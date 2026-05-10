<?php

namespace App\Observers;

use App\Models\Trip;
use App\Services\Vouchers\VoucherOperationalStatusSync;

class TripObserver
{
    public function __construct(
        private VoucherOperationalStatusSync $voucherOperationalStatusSync,
    ) {}

    public function saved(Trip $trip): void
    {
        if (! $trip->wasChanged('status')) {
            return;
        }

        $this->voucherOperationalStatusSync->syncForTrip((int) $trip->organization_id, (int) $trip->id);
    }
}
