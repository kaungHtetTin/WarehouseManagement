<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\User;
use App\Models\VoucherPayment;
use App\Services\Audit\AuditLogger;
use App\Services\Tenant\OperationalWarehouseContext;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FinanceLedgerController extends Controller
{
    public function __construct(
        private OperationalWarehouseContext $operationalContext,
    ) {}

    public function reports(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->accessibleWarehousesForUi($actor)->values();
        $allowedWarehouseIds = $warehouses->pluck('id')->map(fn ($id) => (int) $id)->all();

        $defaultFrom = now()->subMonths(11)->startOfMonth()->toDateString();
        $defaultTo = now()->toDateString();

        $from = (string) $request->query('from', $defaultFrom);
        $to = (string) $request->query('to', $defaultTo);

        $groupBy = strtolower((string) $request->query('group_by', 'month'));
        if (! in_array($groupBy, ['month', 'day'], true)) {
            $groupBy = 'month';
        }

        $scope = strtoupper((string) $request->query('scope', 'all'));
        if (! in_array($scope, ['all', 'GENERAL', 'VOUCHER', 'TRIP_COST'], true)) {
            $scope = 'all';
        }

        $warehouseFilter = (string) $request->query('warehouse_id', 'all');
        $selectedWarehouseId = null;
        $warehouseIsNullOnly = false;
        if ($warehouseFilter === 'none') {
            $warehouseIsNullOnly = true;
        } elseif ($warehouseFilter !== 'all' && $warehouseFilter !== '') {
            $candidate = (int) $warehouseFilter;
            if (in_array($candidate, $allowedWarehouseIds, true)) {
                $selectedWarehouseId = $candidate;
            }
        }

        $fromDate = Carbon::parse($from)->startOfDay();
        $toDate = Carbon::parse($to)->endOfDay();
        if ($fromDate->greaterThan($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
            $from = $fromDate->toDateString();
            $to = $toDate->toDateString();
        }
        if ($groupBy === 'day' && $fromDate->diffInDays($toDate) > 120) {
            $groupBy = 'month';
        }

        $query = FinanceEntry::query()
            ->where('organization_id', $organizationId)
            ->where('occurred_at', '>=', $fromDate)
            ->where('occurred_at', '<=', $toDate);

        if ($scope !== 'all') {
            $query->where('scope', $scope);
        }

        if ($allowedWarehouseIds === []) {
            $query->whereNull('warehouse_id');
        } elseif ($warehouseIsNullOnly) {
            $query->whereNull('warehouse_id');
        } elseif ($selectedWarehouseId !== null) {
            $query->where('warehouse_id', $selectedWarehouseId);
        } else {
            $query->where(function ($q) use ($allowedWarehouseIds) {
                $q->whereNull('warehouse_id')->orWhereIn('warehouse_id', $allowedWarehouseIds);
            });
        }

        $incomeTotal = round((float) (clone $query)->where('direction', 'INCOME')->sum('amount'), 2);
        $expenseTotal = round((float) (clone $query)->where('direction', 'EXPENSE')->sum('amount'), 2);

        $periodExpr = $groupBy === 'day'
            ? 'DATE(occurred_at)'
            : "DATE_FORMAT(occurred_at, '%Y-%m')";

        $rawSeries = (clone $query)
            ->selectRaw("$periodExpr as period")
            ->selectRaw("SUM(CASE WHEN direction = 'INCOME' THEN amount ELSE 0 END) as income")
            ->selectRaw("SUM(CASE WHEN direction = 'EXPENSE' THEN amount ELSE 0 END) as expense")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        $seriesMap = $rawSeries->keyBy(fn ($r) => (string) $r->period);

        $series = [];
        if ($groupBy === 'day') {
            $cursor = $fromDate->copy()->startOfDay();
            $end = $toDate->copy()->startOfDay();
            while ($cursor->lessThanOrEqualTo($end)) {
                $key = $cursor->format('Y-m-d');
                $row = $seriesMap->get($key);
                $income = $row ? round((float) $row->income, 2) : 0.0;
                $expense = $row ? round((float) $row->expense, 2) : 0.0;
                $series[] = [
                    'period' => $key,
                    'income' => $income,
                    'expense' => $expense,
                    'net' => round($income - $expense, 2),
                ];
                $cursor->addDay();
            }
        } else {
            $cursor = $fromDate->copy()->startOfMonth();
            $end = $toDate->copy()->startOfMonth();
            while ($cursor->lessThanOrEqualTo($end)) {
                $key = $cursor->format('Y-m');
                $row = $seriesMap->get($key);
                $income = $row ? round((float) $row->income, 2) : 0.0;
                $expense = $row ? round((float) $row->expense, 2) : 0.0;
                $series[] = [
                    'period' => $key,
                    'income' => $income,
                    'expense' => $expense,
                    'net' => round($income - $expense, 2),
                ];
                $cursor->addMonth();
            }
        }

        $categoryMap = FinanceCategory::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'ACTIVE')
            ->pluck('name', 'id')
            ->mapWithKeys(fn ($name, $id) => [(int) $id => (string) $name])
            ->all();

        $expenseBreakdownRows = (clone $query)
            ->where('direction', 'EXPENSE')
            ->selectRaw('category_id, SUM(amount) as total')
            ->groupBy('category_id')
            ->orderByDesc(DB::raw('total'))
            ->limit(8)
            ->get();

        $incomeBreakdownRows = (clone $query)
            ->where('direction', 'INCOME')
            ->selectRaw('category_id, SUM(amount) as total')
            ->groupBy('category_id')
            ->orderByDesc(DB::raw('total'))
            ->limit(8)
            ->get();

        $expenseCategories = $expenseBreakdownRows->map(function ($r) use ($categoryMap) {
            $categoryId = $r->category_id !== null ? (int) $r->category_id : null;
            return [
                'label' => $categoryId !== null ? ($categoryMap[$categoryId] ?? 'Unknown') : 'Uncategorized',
                'value' => round((float) $r->total, 2),
            ];
        })->values();

        $incomeCategories = $incomeBreakdownRows->map(function ($r) use ($categoryMap) {
            $categoryId = $r->category_id !== null ? (int) $r->category_id : null;
            return [
                'label' => $categoryId !== null ? ($categoryMap[$categoryId] ?? 'Unknown') : 'Uncategorized',
                'value' => round((float) $r->total, 2),
            ];
        })->values();

        return Inertia::render('Admin/Finance/FinanceReports', [
            'filters' => [
                'from' => $from,
                'to' => $to,
                'group_by' => $groupBy,
                'scope' => $scope,
                'warehouse_id' => $warehouseIsNullOnly ? 'none' : ($selectedWarehouseId !== null ? (string) $selectedWarehouseId : 'all'),
            ],
            'warehouses' => $warehouses,
            'totals' => [
                'income' => $incomeTotal,
                'expense' => $expenseTotal,
                'net' => round($incomeTotal - $expenseTotal, 2),
            ],
            'series' => $series,
            'income_categories' => $incomeCategories,
            'expense_categories' => $expenseCategories,
        ]);
    }

    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->accessibleWarehousesForUi($actor)->values();
        $allowedWarehouseIds = $warehouses->pluck('id')->map(fn ($id) => (int) $id)->all();

        $defaultFrom = now()->subDays(30)->toDateString();
        $defaultTo = now()->toDateString();

        $from = $request->query('from', $defaultFrom);
        $to = $request->query('to', $defaultTo);

        $direction = strtoupper((string) $request->query('direction', 'all'));
        if (! in_array($direction, ['all', 'INCOME', 'EXPENSE'], true)) {
            $direction = 'all';
        }

        $scope = strtoupper((string) $request->query('scope', 'all'));
        if (! in_array($scope, ['all', 'GENERAL', 'VOUCHER', 'TRIP_COST'], true)) {
            $scope = 'all';
        }

        $source = strtoupper((string) $request->query('source', 'all'));
        if (! in_array($source, ['all', 'MANUAL', 'SYSTEM'], true)) {
            $source = 'all';
        }

        $warehouseFilter = (string) $request->query('warehouse_id', 'all');
        $selectedWarehouseId = null;
        $warehouseIsNullOnly = false;
        if ($warehouseFilter === 'none') {
            $warehouseIsNullOnly = true;
        } elseif ($warehouseFilter !== 'all' && $warehouseFilter !== '') {
            $candidate = (int) $warehouseFilter;
            if (in_array($candidate, $allowedWarehouseIds, true)) {
                $selectedWarehouseId = $candidate;
            }
        }

        $categoryFilter = (string) $request->query('category_id', 'all');
        $selectedCategoryId = null;
        if ($categoryFilter !== 'all' && $categoryFilter !== '') {
            $selectedCategoryId = (int) $categoryFilter;
        }

        $query = FinanceEntry::query()
            ->where('organization_id', $organizationId);

        if ($from !== null && trim((string) $from) !== '') {
            $query->where('occurred_at', '>=', Carbon::parse($from)->startOfDay());
        }
        if ($to !== null && trim((string) $to) !== '') {
            $query->where('occurred_at', '<=', Carbon::parse($to)->endOfDay());
        }
        if ($direction !== 'all') {
            $query->where('direction', $direction);
        }
        if ($scope !== 'all') {
            $query->where('scope', $scope);
        }
        if ($source !== 'all') {
            $query->where('source', $source);
        }

        if ($allowedWarehouseIds === []) {
            $query->whereNull('warehouse_id');
        } elseif ($warehouseIsNullOnly) {
            $query->whereNull('warehouse_id');
        } elseif ($selectedWarehouseId !== null) {
            $query->where('warehouse_id', $selectedWarehouseId);
        } else {
            $query->where(function ($q) use ($allowedWarehouseIds) {
                $q->whereNull('warehouse_id')->orWhereIn('warehouse_id', $allowedWarehouseIds);
            });
        }

        if ($selectedCategoryId !== null) {
            $query->where('category_id', $selectedCategoryId);
        }

        $incomeTotal = round((float) (clone $query)->where('direction', 'INCOME')->sum('amount'), 2);
        $expenseTotal = round((float) (clone $query)->where('direction', 'EXPENSE')->sum('amount'), 2);

        $rows = (clone $query)
            ->with([
                'category:id,name,scope,direction',
                'warehouse:id,name,code',
                'creator:id,name',
            ])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get([
                'id',
                'organization_id',
                'warehouse_id',
                'scope',
                'direction',
                'category_id',
                'amount',
                'currency',
                'occurred_at',
                'note',
                'reference_type',
                'reference_id',
                'source',
                'created_by',
                'created_at',
                'updated_at',
            ]);

        $paymentIds = $rows
            ->filter(fn ($r) => $r->reference_type === 'VOUCHER_PAYMENT' && $r->reference_id !== null)
            ->pluck('reference_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $paymentVoucherMap = $paymentIds === []
            ? []
            : VoucherPayment::query()
                ->where('organization_id', $organizationId)
                ->whereIn('id', $paymentIds)
                ->pluck('voucher_id', 'id')
                ->map(fn ($id) => (int) $id)
                ->all();

        $entries = $rows->map(function (FinanceEntry $e) use ($paymentVoucherMap) {
            $reference = null;

            if ($e->reference_type === 'TRIP' && $e->reference_id !== null) {
                $reference = [
                    'type' => 'TRIP',
                    'id' => (int) $e->reference_id,
                    'trip_id' => (int) $e->reference_id,
                ];
            } elseif ($e->reference_type === 'VOUCHER_PAYMENT' && $e->reference_id !== null) {
                $pid = (int) $e->reference_id;
                $reference = [
                    'type' => 'VOUCHER_PAYMENT',
                    'id' => $pid,
                    'voucher_id' => $paymentVoucherMap[$pid] ?? null,
                ];
            }

            return [
                'id' => $e->id,
                'warehouse' => $e->warehouse ? $e->warehouse->only(['id', 'code', 'name']) : null,
                'scope' => $e->scope,
                'direction' => $e->direction,
                'category' => $e->category ? $e->category->only(['id', 'name', 'scope', 'direction']) : null,
                'amount' => (float) $e->amount,
                'currency' => $e->currency ?? 'MMK',
                'occurred_at' => $e->occurred_at?->toISOString(),
                'note' => $e->note,
                'reference' => $reference,
                'source' => $e->source,
                'creator' => $e->creator ? $e->creator->only(['id', 'name']) : null,
                'created_at' => $e->created_at?->toISOString(),
                'updated_at' => $e->updated_at?->toISOString(),
            ];
        });

        $categories = FinanceCategory::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'ACTIVE')
            ->orderBy('scope')
            ->orderBy('direction')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'scope', 'direction', 'name']);

        return Inertia::render('Admin/Finance/FinanceLedger', [
            'entries' => $entries,
            'totals' => [
                'income' => $incomeTotal,
                'expense' => $expenseTotal,
                'net' => round($incomeTotal - $expenseTotal, 2),
            ],
            'filters' => [
                'from' => $from,
                'to' => $to,
                'direction' => $direction,
                'scope' => $scope,
                'source' => $source,
                'warehouse_id' => $warehouseIsNullOnly ? 'none' : ($selectedWarehouseId !== null ? (string) $selectedWarehouseId : 'all'),
                'category_id' => $selectedCategoryId !== null ? (string) $selectedCategoryId : 'all',
            ],
            'warehouses' => $warehouses,
            'categories' => $categories,
            'can_manage_finance' => $actor->hasPermission('finance.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->accessibleWarehouseIds($actor);

        $validated = $request->validate([
            'direction' => ['required', Rule::in(['INCOME', 'EXPENSE'])],
            'scope' => ['required', Rule::in(['GENERAL', 'VOUCHER', 'TRIP_COST'])],
            'category_id' => ['nullable', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:1000000000'],
            'currency' => ['nullable', 'string', 'max:8'],
            'occurred_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $warehouseId = null;
        if (array_key_exists('warehouse_id', $validated) && $validated['warehouse_id'] !== null) {
            $candidate = (int) $validated['warehouse_id'];
            abort_if(! in_array($candidate, $warehouses, true), 422, 'Invalid warehouse.');
            $warehouseId = $candidate;
        }

        $categoryId = null;
        if (array_key_exists('category_id', $validated) && $validated['category_id'] !== null) {
            $cat = FinanceCategory::query()
                ->where('organization_id', $organizationId)
                ->whereKey((int) $validated['category_id'])
                ->firstOrFail();

            abort_if($cat->scope !== $validated['scope'], 422, 'Category scope does not match entry scope.');
            if ($cat->direction !== 'BOTH') {
                abort_if($cat->direction !== $validated['direction'], 422, 'Category direction does not match entry direction.');
            }
            $categoryId = (int) $cat->id;
        }

        $entry = null;
        DB::transaction(function () use (&$entry, $validated, $organizationId, $actor, $warehouseId, $categoryId) {
            $entry = FinanceEntry::query()->create([
                'organization_id' => $organizationId,
                'warehouse_id' => $warehouseId,
                'scope' => $validated['scope'],
                'direction' => $validated['direction'],
                'category_id' => $categoryId,
                'amount' => round((float) $validated['amount'], 2),
                'currency' => isset($validated['currency']) && trim((string) $validated['currency']) !== ''
                    ? trim((string) $validated['currency'])
                    : 'MMK',
                'occurred_at' => Carbon::parse($validated['occurred_at']),
                'note' => isset($validated['note']) ? trim((string) $validated['note']) : null,
                'reference_type' => null,
                'reference_id' => null,
                'source' => 'MANUAL',
                'created_by' => $actor->id,
            ]);
        });

        AuditLogger::record($actor, 'finance_entry.create', $entry, [
            'direction' => $entry->direction,
            'scope' => $entry->scope,
            'amount' => (float) $entry->amount,
            'currency' => $entry->currency,
            'source' => $entry->source,
        ]);

        return Redirect::route('admin.finance.ledger.index')
            ->with('success', 'Finance entry added.');
    }

    public function update(Request $request, string $entry): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $warehouses = $this->operationalContext->accessibleWarehouseIds($actor);

        $model = $this->resolveTenantEntry($actor, $entry);
        abort_if($model->source !== 'MANUAL', 403);

        $validated = $request->validate([
            'direction' => ['sometimes', 'required', Rule::in(['INCOME', 'EXPENSE'])],
            'scope' => ['sometimes', 'required', Rule::in(['GENERAL', 'VOUCHER', 'TRIP_COST'])],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'warehouse_id' => ['sometimes', 'nullable', 'integer'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0.01', 'max:1000000000'],
            'currency' => ['sometimes', 'nullable', 'string', 'max:8'],
            'occurred_at' => ['sometimes', 'required', 'date'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        $nextScope = array_key_exists('scope', $validated) ? $validated['scope'] : $model->scope;
        $nextDirection = array_key_exists('direction', $validated) ? $validated['direction'] : $model->direction;

        if (array_key_exists('warehouse_id', $validated)) {
            if ($validated['warehouse_id'] === null) {
                $model->warehouse_id = null;
            } else {
                $candidate = (int) $validated['warehouse_id'];
                abort_if(! in_array($candidate, $warehouses, true), 422, 'Invalid warehouse.');
                $model->warehouse_id = $candidate;
            }
        }

        if (array_key_exists('category_id', $validated)) {
            if ($validated['category_id'] === null) {
                $model->category_id = null;
            } else {
                $cat = FinanceCategory::query()
                    ->where('organization_id', $organizationId)
                    ->whereKey((int) $validated['category_id'])
                    ->firstOrFail();
                abort_if($cat->scope !== $nextScope, 422, 'Category scope does not match entry scope.');
                if ($cat->direction !== 'BOTH') {
                    abort_if($cat->direction !== $nextDirection, 422, 'Category direction does not match entry direction.');
                }
                $model->category_id = (int) $cat->id;
            }
        }

        if (array_key_exists('scope', $validated)) {
            $model->scope = $validated['scope'];
        }
        if (array_key_exists('direction', $validated)) {
            $model->direction = $validated['direction'];
        }
        if (array_key_exists('amount', $validated)) {
            $model->amount = round((float) $validated['amount'], 2);
        }
        if (array_key_exists('currency', $validated)) {
            $model->currency = $validated['currency'] !== null && trim((string) $validated['currency']) !== ''
                ? trim((string) $validated['currency'])
                : 'MMK';
        }
        if (array_key_exists('occurred_at', $validated)) {
            $model->occurred_at = Carbon::parse($validated['occurred_at']);
        }
        if (array_key_exists('note', $validated)) {
            $model->note = $validated['note'] !== null ? trim((string) $validated['note']) : null;
        }

        $model->save();

        AuditLogger::record($actor, 'finance_entry.update', $model, [
            'direction' => $model->direction,
            'scope' => $model->scope,
            'amount' => (float) $model->amount,
            'currency' => $model->currency,
            'source' => $model->source,
        ]);

        return Redirect::route('admin.finance.ledger.index')
            ->with('success', 'Finance entry updated.');
    }

    public function destroy(Request $request, string $entry): RedirectResponse
    {
        $actor = $request->user();
        $model = $this->resolveTenantEntry($actor, $entry);
        abort_if($model->source !== 'MANUAL', 403);

        $snapshot = [
            'direction' => $model->direction,
            'scope' => $model->scope,
            'amount' => (float) $model->amount,
            'currency' => $model->currency,
            'occurred_at' => $model->occurred_at?->toISOString(),
        ];

        $model->delete();

        AuditLogger::record($actor, 'finance_entry.delete', null, $snapshot);

        return Redirect::route('admin.finance.ledger.index')
            ->with('success', 'Finance entry deleted.');
    }

    private function resolveTenantEntry(User $user, string $id): FinanceEntry
    {
        abort_if($user->organization_id === null, 404);

        return FinanceEntry::query()
            ->where('organization_id', $user->organization_id)
            ->whereKey($id)
            ->firstOrFail();
    }
}
