<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CategoryManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $categories = Category::query()
            ->where('organization_id', $organizationId)
            ->with('parent:id,name')
            ->orderBy('name')
            ->get(['id', 'organization_id', 'name', 'code', 'parent_id', 'updated_at']);

        return Inertia::render('Admin/Master/CategoriesIndex', [
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'code' => ['nullable', 'string', 'max:64'],
            'parent_id' => ['nullable', 'integer'],
        ]);

        $parent = $this->resolveParentCategory($organizationId, $validated['parent_id'] ?? null);

        $category = Category::query()->create([
            'organization_id' => $organizationId,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'parent_id' => $parent?->id,
        ]);

        AuditLogger::record($actor, 'category.create', $category, [
            'name' => $category->name,
        ]);

        return Redirect::route('admin.categories.index')->with('success', 'Category created successfully.');
    }

    public function update(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')
                    ->ignore($categoryModel->id)
                    ->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'code' => ['sometimes', 'nullable', 'string', 'max:64'],
            'parent_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        if (array_key_exists('parent_id', $validated)) {
            $parent = $this->resolveParentCategory($organizationId, $validated['parent_id']);
            $validated['parent_id'] = $parent?->id;
        }

        $categoryModel->fill($validated);
        $categoryModel->save();

        AuditLogger::record($actor, 'category.update', $categoryModel, [
            'name' => $categoryModel->name,
        ]);

        return Redirect::route('admin.categories.index')->with('success', 'Category updated successfully.');
    }

    public function destroy(Request $request, string $category): RedirectResponse
    {
        $actor = $request->user();
        $categoryModel = $this->resolveTenantCategory($actor, $category);

        $snapshot = [
            'name' => $categoryModel->name,
            'code' => $categoryModel->code,
        ];

        $categoryModel->delete();

        AuditLogger::record($actor, 'category.delete', null, $snapshot);

        return Redirect::route('admin.categories.index')->with('success', 'Category deleted successfully.');
    }

    private function resolveTenantCategory(User $user, string $categoryId): Category
    {
        abort_if($user->organization_id === null, 404);

        return Category::query()
            ->whereKey($categoryId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }

    private function resolveParentCategory(?int $organizationId, ?int $parentId): ?Category
    {
        if ($parentId === null) {
            return null;
        }

        return Category::query()
            ->where('organization_id', $organizationId)
            ->whereKey($parentId)
            ->firstOrFail();
    }
}
