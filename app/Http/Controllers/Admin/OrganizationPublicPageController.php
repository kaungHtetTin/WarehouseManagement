<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationPublicPage;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

class OrganizationPublicPageController extends Controller
{
    public function edit(Request $request): RedirectResponse
    {
        return Redirect::route('admin.organization-settings.edit', ['tab' => 'public']);
    }

    public function update(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $page = OrganizationPublicPage::query()
            ->where('organization_id', $organizationId)
            ->first();

        if (! $page) {
            $organization = Organization::query()->whereKey($organizationId)->firstOrFail();
            $page = OrganizationPublicPage::query()->create([
                'organization_id' => $organizationId,
                'slug' => $organization->code,
                'is_published' => false,
                'business_name' => $organization->name,
            ]);
        }

        $validated = $request->validate([
            'slug' => [
                'required',
                'string',
                'max:80',
                Rule::unique('organization_public_pages', 'slug')->ignore($page->id),
            ],
            'is_published' => ['required', 'boolean'],
            'business_name' => ['nullable', 'string', 'max:255'],
            'about' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'kpis' => ['nullable', 'array', 'max:8'],
            'kpis.*.label' => ['required_with:kpis', 'string', 'max:40'],
            'kpis.*.value' => ['required_with:kpis', 'string', 'max:40'],
            'services' => ['nullable', 'array', 'max:12'],
            'services.*.title' => ['required_with:services', 'string', 'max:80'],
            'services.*.description' => ['nullable', 'string', 'max:500'],
            'gallery' => ['nullable', 'array', 'max:24'],
            'gallery.*.url' => ['required_with:gallery', 'string', 'max:255'],
            'faqs' => ['nullable', 'array', 'max:12'],
            'faqs.*.q' => ['required_with:faqs', 'string', 'max:120'],
            'faqs.*.a' => ['nullable', 'string', 'max:800'],
        ]);

        $page->fill($validated);
        $page->save();

        AuditLogger::record($actor, 'public_page.update', $page, [
            'is_published' => $page->is_published,
            'slug' => $page->slug,
        ]);

        return Redirect::route('admin.organization-settings.edit', ['tab' => 'public'])
            ->with('success', 'Public page updated successfully.');
    }
}
