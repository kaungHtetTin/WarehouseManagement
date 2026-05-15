<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinanceCategory;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TripCostCategoryController extends Controller
{
    private const CATEGORY_SCOPE = 'TRIP_COST';

    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $rows = FinanceCategory::query()
            ->where('organization_id', $organizationId)
            ->where('scope', self::CATEGORY_SCOPE)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'organization_id', 'name', 'status', 'sort_order', 'updated_at']);

        return Inertia::render('Admin/Master/TripCostCategoriesIndex', [
            'categories' => $rows,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('finance_categories', 'name')
                    ->where(fn ($q) => $q->where('organization_id', $organizationId)->where('scope', self::CATEGORY_SCOPE)->whereNull('deleted_at')),
            ],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE'])],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $row = FinanceCategory::query()->create([
            'organization_id' => $organizationId,
            'scope' => self::CATEGORY_SCOPE,
            'direction' => 'EXPENSE',
            'name' => trim($validated['name']),
            'status' => $validated['status'] ?? 'ACTIVE',
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        AuditLogger::record($actor, 'trip_cost_category.create', $row, [
            'name' => $row->name,
        ]);

        return Redirect::route('admin.trip-cost-categories.index')
            ->with('success', 'Category created successfully.');
    }

    public function update(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('finance_categories', 'name')
                    ->ignore($categoryModel->id)
                    ->where(fn ($q) => $q->where('organization_id', $organizationId)->where('scope', self::CATEGORY_SCOPE)->whereNull('deleted_at')),
            ],
            'status' => ['sometimes', 'nullable', Rule::in(['ACTIVE', 'INACTIVE'])],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
        }
        if (array_key_exists('sort_order', $validated) && $validated['sort_order'] !== null) {
            $validated['sort_order'] = (int) $validated['sort_order'];
        }

        $categoryModel->fill($validated);
        $categoryModel->scope = self::CATEGORY_SCOPE;
        $categoryModel->direction = 'EXPENSE';
        $categoryModel->save();

        AuditLogger::record($actor, 'trip_cost_category.update', $categoryModel, [
            'name' => $categoryModel->name,
        ]);

        return Redirect::route('admin.trip-cost-categories.index')
            ->with('success', 'Category updated successfully.');
    }

    public function destroy(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $snapshot = [
            'name' => $categoryModel->name,
            'status' => $categoryModel->status,
        ];

        $categoryModel->delete();

        AuditLogger::record($actor, 'trip_cost_category.delete', null, $snapshot);

        return Redirect::route('admin.trip-cost-categories.index')
            ->with('success', 'Category deleted successfully.');
    }

    private function resolveTenantCategory(User $user, string $id): FinanceCategory
    {
        abort_if($user->organization_id === null, 404);

        return FinanceCategory::query()
            ->where('organization_id', $user->organization_id)
            ->where('scope', self::CATEGORY_SCOPE)
            ->whereKey($id)
            ->firstOrFail();
    }
}
