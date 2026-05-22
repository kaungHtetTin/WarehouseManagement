<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\Trip;
use App\Models\Voucher;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicVoucherTrackingController extends Controller
{
    public function show(Request $request, string $org, string $voucherNo): Response
    {
        $organization = Organization::query()
            ->where('code', $org)
            ->firstOrFail(['id', 'name', 'code']);

        $voucher = Voucher::query()
            ->where('organization_id', $organization->id)
            ->where('voucher_no', $voucherNo)
            ->where('status', '!=', 'DRAFT')
            ->with([
                'defaultToWarehouse:id,city,address',
                'sourceWarehouse:id,city,address',
            ])
            ->firstOrFail([
                'id',
                'organization_id',
                'voucher_no',
                'voucher_date',
                'status',
                'default_to_warehouse_id',
                'default_to_city',
                'default_to_address_line1',
                'default_recipient_name',
                'default_recipient_phone',
                'updated_at',
            ]);

        $trip = Trip::query()
            ->where('organization_id', $organization->id)
            ->whereHas('items.voucherItem', fn ($q) => $q->where('voucher_id', $voucher->id))
            ->orderByDesc('id')
            ->first(['id', 'trip_no', 'status', 'updated_at']);

        $tracking = $this->resolveTracking($voucher->status, $trip?->status);

        return Inertia::render('Public/VoucherTracking', [
            'organization' => $organization,
            'voucher' => $voucher,
            'trip' => $trip,
            'tracking' => $tracking,
        ]);
    }

    /**
     * @return array{label:string,code:string,step:int}
     */
    private function resolveTracking(string $voucherStatus, ?string $tripStatus): array
    {
        $voucherStatus = strtoupper(trim($voucherStatus));
        $tripStatus = $tripStatus !== null ? strtoupper(trim($tripStatus)) : null;

        if (in_array($voucherStatus, ['DELIVERED', 'CLOSED'], true)) {
            return ['label' => 'Delivered', 'code' => 'DELIVERED', 'step' => 3];
        }

        if (in_array($tripStatus, ['DEPARTED', 'AT_STOP'], true)) {
            return ['label' => 'In transit', 'code' => 'IN_TRANSIT', 'step' => 2];
        }

        if (in_array($tripStatus, ['PLANNED', 'LOADING'], true)) {
            return ['label' => 'Loading', 'code' => 'LOADING', 'step' => 1];
        }

        return ['label' => 'Confirmed', 'code' => 'CONFIRMED', 'step' => 0];
    }
}

