<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationPublicPage;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicOrganizationPageController extends Controller
{
    public function show(Request $request, string $slug): Response
    {
        $page = OrganizationPublicPage::query()
            ->where('slug', $slug)
            ->where('is_published', true)
            ->with('organization:id,name,code')
            ->first();

        if (! $page) {
            $organization = Organization::query()->where('code', $slug)->first();
            if ($organization) {
                $page = OrganizationPublicPage::query()
                    ->where('organization_id', $organization->id)
                    ->where('is_published', true)
                    ->with('organization:id,name,code')
                    ->first();
            }
        }

        abort_if(! $page, 404);

        return Inertia::render('Public/OrganizationPublicPage', [
            'organization' => $page->organization?->only(['id', 'name', 'code']),
            'publicPage' => $page,
        ]);
    }
}

