<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationPublicPage;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationSettingsController extends Controller
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

        $publicPage = [
            'id' => $page->id,
            'slug' => $page->slug,
            'is_published' => (bool) $page->is_published,
            'business_name' => $page->business_name,
            'about' => $page->about,
            'phone' => $page->phone,
            'email' => $page->email,
            'address' => $page->address,
            'logo_url' => $page->logo_url,
            'cover_url' => $page->cover_url,
            'theme_color' => $page->theme_color,
            'kpis' => is_array($page->kpis) ? $page->kpis : [],
            'services' => is_array($page->services) ? $page->services : [],
            'gallery' => is_array($page->gallery) ? $page->gallery : [],
            'faqs' => is_array($page->faqs) ? $page->faqs : [],
        ];

        return Inertia::render('Admin/System/OrganizationSettings', [
            'organization' => $organization->only(['id', 'name', 'code']),
            'publicPage' => $publicPage,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'theme_color' => ['nullable', 'string', 'max:32', 'regex:/^#?[0-9a-fA-F]{6}$/'],
        ]);

        $themeColor = $validated['theme_color'] ?? null;
        if (filled($themeColor)) {
            $themeColor = strtoupper(trim((string) $themeColor));
            if (! str_starts_with($themeColor, '#')) {
                $themeColor = '#'.$themeColor;
            }
            $validated['theme_color'] = $themeColor;
        }

        DB::transaction(function () use ($organizationId, $validated, $actor) {
            $organization = Organization::query()
                ->whereKey($organizationId)
                ->lockForUpdate()
                ->firstOrFail();

            $organization->name = $validated['name'];
            $organization->save();

            $page = OrganizationPublicPage::query()
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->first();

            if (! $page) {
                $page = OrganizationPublicPage::query()->create([
                    'organization_id' => $organizationId,
                    'slug' => $organization->code,
                    'is_published' => false,
                    'business_name' => $organization->name,
                ]);
            }

            $page->business_name = $validated['name'];
            $page->theme_color = $validated['theme_color'] ?? null;
            $page->save();

            AuditLogger::record($actor, 'organization.settings.update', $organization, [
                'public_page_theme_color' => $page->theme_color,
            ]);
        });

        return Redirect::route('admin.organization-settings.edit')->with('success', 'Organization settings updated successfully.');
    }

    public function uploadLogo(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'logo' => ['required', 'file', 'image', 'max:2048'],
        ]);

        $file = $validated['logo'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
        if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
            $ext = 'png';
        }

        $path = "org/{$organizationId}/logo.{$ext}";
        Storage::disk('public')->putFileAs("org/{$organizationId}", $file, "logo.{$ext}");
        $url = Storage::disk('public')->url($path);

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

        $page->logo_url = $url;
        $page->save();

        AuditLogger::record($actor, 'organization.logo.upload', $page, [
            'logo_url' => $page->logo_url,
        ]);

        return Redirect::route('admin.organization-settings.edit', ['tab' => 'public'])
            ->with('success', 'Logo uploaded successfully.');
    }

    public function uploadCover(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'cover' => ['required', 'file', 'image', 'max:5120'],
        ]);

        $file = $validated['cover'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
            $ext = 'jpg';
        }

        $path = "org/{$organizationId}/cover.{$ext}";
        Storage::disk('public')->putFileAs("org/{$organizationId}", $file, "cover.{$ext}");
        $url = Storage::disk('public')->url($path);

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

        $page->cover_url = $url;
        $page->save();

        AuditLogger::record($actor, 'organization.cover.upload', $page, [
            'cover_url' => $page->cover_url,
        ]);

        return Redirect::route('admin.organization-settings.edit', ['tab' => 'public'])
            ->with('success', 'Cover uploaded successfully.');
    }

    public function uploadGallery(Request $request): RedirectResponse
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $validated = $request->validate([
            'photo' => ['required', 'file', 'image', 'max:5120'],
        ]);

        $file = $validated['photo'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
            $ext = 'jpg';
        }

        $name = bin2hex(random_bytes(8));
        $path = "org/{$organizationId}/gallery/{$name}.{$ext}";
        Storage::disk('public')->putFileAs("org/{$organizationId}/gallery", $file, "{$name}.{$ext}");
        $url = Storage::disk('public')->url($path);

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

        $gallery = is_array($page->gallery) ? $page->gallery : [];
        $gallery[] = ['url' => $url];
        $page->gallery = $gallery;
        $page->save();

        AuditLogger::record($actor, 'organization.gallery.upload', $page, [
            'photo_url' => $url,
        ]);

        return Redirect::route('admin.organization-settings.edit', ['tab' => 'public'])
            ->with('success', 'Gallery photo added successfully.');
    }
}
