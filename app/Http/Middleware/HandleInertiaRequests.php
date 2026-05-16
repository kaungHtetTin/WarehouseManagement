<?php

namespace App\Http\Middleware;

use App\Models\TripItem;
use App\Models\Voucher;
use App\Models\WarehouseFulfillmentInstruction;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $path = parse_url(url('/'), PHP_URL_PATH) ?: '';

        return array_merge(parent::share($request), [
            'app_url' => config('app.url'),
            'admin_app_url' => config('app.admin_app_url'),
            'app_base' => $path,
            'auth' => [
                'user' => $request->user(),
                'permission_codes' => fn () => $request->user()?->allPermissionCodes() ?? [],
            ],
            'nav_counts' => fn () => [
                'fulfillment_incoming' => $this->fulfillmentIncomingCount($request),
                'fulfillment_inbox_pending' => $this->fulfillmentInboxPendingCount($request),
                'vouchers_pending' => $this->vouchersPendingCount($request),
                'trips_pending' => $this->tripsPendingCount($request),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }

    private function fulfillmentInboxPendingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('trips.view') && ! $user->hasPermission('trips.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->assignedWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        $orgId = (int) $user->organization_id;

        $count = WarehouseFulfillmentInstruction::query()
            ->from('warehouse_fulfillment_instructions as wfi')
            ->join('voucher_items as vi', function ($j) use ($orgId) {
                $j->on('vi.id', '=', 'wfi.voucher_item_id')
                    ->where('vi.organization_id', '=', $orgId);
            })
            ->join('vouchers as v', function ($j) use ($orgId) {
                $j->on('v.id', '=', 'vi.voucher_id')
                    ->where('v.organization_id', '=', $orgId);
            })
            ->where('wfi.organization_id', $orgId)
            ->whereIn('wfi.warehouse_id', $allowedIds)
            ->where(function ($q) {
                $q->where('wfi.status', 'PENDING_ACTION')
                    ->orWhere(function ($q2) {
                        $q2->where('wfi.status', 'COMPLETED')
                            ->whereIn('v.payment_status', ['UNPAID', 'PARTIAL']);
                    });
            })
            ->selectRaw('COUNT(DISTINCT CONCAT(wfi.warehouse_id, ":", v.id)) as c')
            ->value('c');

        return (int) ($count ?? 0);
    }

    private function fulfillmentIncomingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('trips.view') && ! $user->hasPermission('trips.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->assignedWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        $orgId = (int) $user->organization_id;

        return TripItem::query()
            ->from('trip_items as ti')
            ->join('trips as t', function ($j) use ($orgId) {
                $j->on('t.id', '=', 'ti.trip_id')
                    ->where('t.organization_id', '=', $orgId);
            })
            ->join('voucher_items as vi', function ($j) use ($orgId) {
                $j->on('vi.id', '=', 'ti.voucher_item_id')
                    ->where('vi.organization_id', '=', $orgId);
            })
            ->join('vouchers as v', function ($j) use ($orgId) {
                $j->on('v.id', '=', 'vi.voucher_id')
                    ->where('v.organization_id', '=', $orgId);
            })
            ->leftJoin('trip_stops as ts', function ($j) use ($orgId) {
                $j->on('ts.id', '=', 'ti.trip_stop_id')
                    ->on('ts.trip_id', '=', 'ti.trip_id')
                    ->where('ts.organization_id', '=', $orgId);
            })
            ->where('ti.organization_id', $orgId)
            ->whereIn('t.status', ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP'])
            ->where('ti.loaded_qty', '>', 0)
            ->whereRaw('(ti.loaded_qty - ti.delivered_qty) > 0.0001')
            ->whereRaw('COALESCE(ts.warehouse_id, v.default_to_warehouse_id) IS NOT NULL')
            ->whereIn(DB::raw('COALESCE(ts.warehouse_id, v.default_to_warehouse_id)'), $allowedIds)
            ->whereNotExists(function ($q) use ($orgId) {
                $q->select(DB::raw(1))
                    ->from('warehouse_fulfillment_instructions as wfi')
                    ->where('wfi.organization_id', $orgId)
                    ->whereColumn('wfi.trip_item_id', 'ti.id')
                    ->whereColumn('wfi.voucher_item_id', 'ti.voucher_item_id')
                    ->whereRaw('wfi.warehouse_id = COALESCE(ts.warehouse_id, v.default_to_warehouse_id)');
            })
            ->count();
    }

    private function vouchersPendingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('vouchers.view') && ! $user->hasPermission('vouchers.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->assignedWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        return Voucher::query()
            ->where('organization_id', $user->organization_id)
            ->where('status', '!=', 'DRAFT')
            ->whereIn('source_warehouse_id', $allowedIds)
            ->whereIn('payment_status', ['UNPAID', 'PARTIAL'])
            ->count();
    }

    private function tripsPendingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('trips.view') && ! $user->hasPermission('trips.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->assignedWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        return \App\Models\Trip::query()
            ->where('organization_id', $user->organization_id)
            ->whereIn('source_warehouse_id', $allowedIds)
            ->whereNotIn('status', ['COMPLETED', 'CANCELLED'])
            ->count();
    }
}
