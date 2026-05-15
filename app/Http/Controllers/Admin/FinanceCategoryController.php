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

class FinanceCategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $rawScope = $request->query('scope', 'all');
        $selectedScope = in_array($rawScope, ['GENERAL', 'VOUCHER', 'TRIP_COST'], true) ? $rawScope : 'all';

        $rows = FinanceCategory::query()
            ->where('organization_id', $organizationId);

        if ($selectedScope !== 'all') {
            $rows->where('scope', $selectedScope);
        }

        $rows = $rows
            ->orderBy('scope')
            ->orderBy('direction')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'organization_id', 'scope', 'direction', 'name', 'status', 'sort_order', 'updated_at']);

        return Inertia::render('Admin/Finance/FinanceCategoriesIndex', [
            'categories' => $rows,
            'filters' => [
                'scope' => $selectedScope,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'scope' => ['required', Rule::in(['GENERAL', 'VOUCHER', 'TRIP_COST'])],
            'direction' => ['required', Rule::in(['INCOME', 'EXPENSE', 'BOTH'])],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('finance_categories', 'name')
                    ->where(fn ($q) => $q
                        ->where('organization_id', $organizationId)
                        ->where('scope', $request->input('scope'))
                        ->whereNull('deleted_at')),
            ],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE'])],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);

        $row = FinanceCategory::query()->create([
            'organization_id' => $organizationId,
            'scope' => $validated['scope'],
            'direction' => $validated['direction'],
            'name' => trim($validated['name']),
            'status' => $validated['status'] ?? 'ACTIVE',
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        AuditLogger::record($actor, 'finance_category.create', $row, [
            'scope' => $row->scope,
            'direction' => $row->direction,
            'name' => $row->name,
        ]);

        return Redirect::route('admin.finance.categories.index', ['scope' => $validated['scope']])
            ->with('success', 'Category created successfully.');
    }

    public function update(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $validated = $request->validate([
            'scope' => ['sometimes', 'required', Rule::in(['GENERAL', 'VOUCHER', 'TRIP_COST'])],
            'direction' => ['sometimes', 'required', Rule::in(['INCOME', 'EXPENSE', 'BOTH'])],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('finance_categories', 'name')
                    ->ignore($categoryModel->id)
                    ->where(fn ($q) => $q
                        ->where('organization_id', $organizationId)
                        ->where('scope', $request->input('scope', $categoryModel->scope))
                        ->whereNull('deleted_at')),
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
        $categoryModel->save();

        AuditLogger::record($actor, 'finance_category.update', $categoryModel, [
            'scope' => $categoryModel->scope,
            'direction' => $categoryModel->direction,
            'name' => $categoryModel->name,
        ]);

        return Redirect::route('admin.finance.categories.index', ['scope' => $categoryModel->scope])
            ->with('success', 'Category updated successfully.');
    }

    public function destroy(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $snapshot = [
            'scope' => $categoryModel->scope,
            'direction' => $categoryModel->direction,
            'name' => $categoryModel->name,
        ];

        $categoryModel->delete();

        AuditLogger::record($actor, 'finance_category.delete', null, $snapshot);

        return Redirect::route('admin.finance.categories.index', ['scope' => $categoryModel->scope])
            ->with('success', 'Category deleted successfully.');
    }

    private function resolveTenantCategory(User $user, string $id): FinanceCategory
    {
        abort_if($user->organization_id === null, 404);

        return FinanceCategory::query()
            ->where('organization_id', $user->organization_id)
            ->whereKey($id)
            ->firstOrFail();
    }
}

