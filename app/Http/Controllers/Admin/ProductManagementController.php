<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProductManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $products = Product::query()
            ->where('organization_id', $organizationId)
            ->with('category:id,name')
            ->orderBy('name')
            ->get(['id', 'organization_id', 'category_id', 'sku', 'name', 'unit', 'default_weight', 'status', 'updated_at']);

        $categories = Category::query()
            ->where('organization_id', $organizationId)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Admin/Master/ProductsIndex', [
            'products' => $products,
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        $validated = $this->validatePayload($request);
        $validated['sku'] = $this->normalizeOptionalSku($validated['sku'] ?? null);
        $validated['default_weight'] = $this->normalizeOptionalDecimal($validated['default_weight'] ?? null);

        $category = $this->resolveTenantCategory($organizationId, $validated['category_id'] ?? null);

        $product = Product::query()->create([
            'organization_id' => $organizationId,
            'category_id' => $category?->id,
            'sku' => $validated['sku'],
            'name' => $validated['name'],
            'unit' => $validated['unit'],
            'default_weight' => $validated['default_weight'],
            'status' => $validated['status'] ?? 'ACTIVE',
        ]);

        AuditLogger::record($actor, 'product.create', $product, [
            'name' => $product->name,
        ]);

        return Redirect::route('admin.products.index')->with('success', 'Product created successfully.');
    }

    public function update(Request $request, string $product): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        $productModel = $this->resolveTenantProduct($actor, $product);
        $validated = $this->validatePayload($request, true);

        if (array_key_exists('category_id', $validated)) {
            $category = $this->resolveTenantCategory($organizationId, $validated['category_id']);
            $validated['category_id'] = $category?->id;
        }

        if (array_key_exists('sku', $validated)) {
            $validated['sku'] = $this->normalizeOptionalSku($validated['sku']);
        }

        if (array_key_exists('default_weight', $validated)) {
            $validated['default_weight'] = $this->normalizeOptionalDecimal($validated['default_weight']);
        }

        $productModel->fill($validated);
        $productModel->save();

        AuditLogger::record($actor, 'product.update', $productModel, [
            'name' => $productModel->name,
        ]);

        return Redirect::route('admin.products.index')->with('success', 'Product updated successfully.');
    }

    public function destroy(Request $request, string $product): RedirectResponse
    {
        $actor = $request->user();
        $productModel = $this->resolveTenantProduct($actor, $product);

        $snapshot = [
            'name' => $productModel->name,
            'sku' => $productModel->sku,
        ];

        $productModel->delete();

        AuditLogger::record($actor, 'product.delete', null, $snapshot);

        return Redirect::route('admin.products.index')->with('success', 'Product deleted successfully.');
    }

    private function validatePayload(Request $request, bool $isUpdate = false): array
    {
        if ($request->has('default_weight')) {
            $raw = $request->input('default_weight');
            if ($raw === '' || (is_string($raw) && trim($raw) === '')) {
                $request->merge(['default_weight' => null]);
            }
        }

        $required = $isUpdate ? 'sometimes|required' : 'required';
        $nullableRequired = $isUpdate ? 'sometimes|nullable' : 'nullable';

        return $request->validate([
            'category_id' => [$nullableRequired, 'integer'],
            'sku' => ['nullable', 'string', 'max:128'],
            'name' => [$required, 'string', 'max:255'],
            'unit' => [$required, 'string', 'max:32'],
            'default_weight' => ['nullable', 'numeric', 'min:0'],
            'status' => [$isUpdate ? 'sometimes' : 'nullable', 'in:ACTIVE,INACTIVE'],
        ]);
    }

    private function resolveTenantCategory(?int $organizationId, ?int $categoryId): ?Category
    {
        if ($categoryId === null) {
            return null;
        }

        return Category::query()
            ->where('organization_id', $organizationId)
            ->whereKey($categoryId)
            ->firstOrFail();
    }

    private function resolveTenantProduct(User $user, string $productId): Product
    {
        abort_if($user->organization_id === null, 404);

        return Product::query()
            ->whereKey($productId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }

    private function normalizeOptionalSku(?string $sku): ?string
    {
        if ($sku === null) {
            return null;
        }

        $trimmed = trim($sku);

        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeOptionalDecimal(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return null;
            }
            $value = $trimmed;
        }

        if (! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }
}
