<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class MerchantManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $organizationId = $request->user()->organization_id;

        $merchants = Merchant::query()
            ->where('organization_id', $organizationId)
            ->orderBy('name')
            ->get(['id', 'organization_id', 'name', 'phone', 'nrc_or_id', 'address', 'updated_at']);

        return Inertia::render('Admin/Master/MerchantsIndex', [
            'merchants' => $merchants,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'nrc_or_id' => ['nullable', 'string', 'max:128'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $merchant = Merchant::query()->create([
            'organization_id' => $organizationId,
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'nrc_or_id' => $validated['nrc_or_id'] ?? null,
            'address' => $validated['address'] ?? null,
        ]);

        AuditLogger::record($actor, 'merchant.create', $merchant, ['name' => $merchant->name]);

        return Redirect::route('admin.merchants.index')->with('success', 'Merchant created successfully.');
    }

    public function update(Request $request, string $merchant): RedirectResponse
    {
        $actor = $request->user();
        $merchantModel = $this->resolveTenantMerchant($actor, $merchant);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'nrc_or_id' => ['sometimes', 'nullable', 'string', 'max:128'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $merchantModel->fill($validated);
        $merchantModel->save();

        AuditLogger::record($actor, 'merchant.update', $merchantModel, ['name' => $merchantModel->name]);

        return Redirect::route('admin.merchants.index')->with('success', 'Merchant updated successfully.');
    }

    public function destroy(Request $request, string $merchant): RedirectResponse
    {
        $actor = $request->user();
        $merchantModel = $this->resolveTenantMerchant($actor, $merchant);

        $snapshot = ['name' => $merchantModel->name];
        $merchantModel->delete();

        AuditLogger::record($actor, 'merchant.delete', null, $snapshot);

        return Redirect::route('admin.merchants.index')->with('success', 'Merchant deleted successfully.');
    }

    private function resolveTenantMerchant(User $user, string $merchantId): Merchant
    {
        abort_if($user->organization_id === null, 404);

        return Merchant::query()
            ->whereKey($merchantId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();
    }
}
