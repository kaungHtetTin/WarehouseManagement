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
use Inertia\Inertia;
use Inertia\Response;

class OrganizationPublicPageController extends Controller
{
    public function edit(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $organization = Organization::query()
            ->whereKey($organizationId)
            ->firstOrFail();

        $page = OrganizationPublicPage::query()->firstOrCreate(
            ['organization_id' => $organizationId],
            [
                'slug' => $organization->code,
                'is_published' => false,
                'business_name' => $organization->name,
            ],
        );

        return Inertia::render('Admin/System/PublicPageEdit', [
            'organization' => $organization->only(['id', 'name', 'code']),
            'publicPage' => $page,
        ]);
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
            'website_url' => ['nullable', 'string', 'max:255'],
            'facebook_url' => ['nullable', 'string', 'max:255'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'cover_url' => ['nullable', 'string', 'max:255'],
        ]);

        $page->fill($validated);
        $page->save();

        AuditLogger::record($actor, 'public_page.update', $page, [
            'is_published' => $page->is_published,
            'slug' => $page->slug,
        ]);

        return Redirect::route('admin.public-page.edit')->with('success', 'Public page updated successfully.');
    }
}

