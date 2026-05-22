<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Organization;
use App\Services\Audit\AuditLogger;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $organization = null;

        if ($user?->organization_id) {
            $organization = Organization::query()
                ->whereKey($user->organization_id)
                ->first(['id', 'name', 'code']);
        }

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            'organization' => $organization,
            'canManageOrganization' => $user?->hasPermission('public_page.manage') ?? false,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $removeProfileImage = (bool) ($validated['remove_profile_image'] ?? false);
        $canManageOrganization = $user->hasPermission('public_page.manage');

        $user->fill(Arr::only($validated, ['name', 'email']));

        if ($removeProfileImage && $user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
            $user->profile_image_path = null;
        }

        if ($request->hasFile('profile_image')) {
            if ($user->profile_image_path) {
                Storage::disk('public')->delete($user->profile_image_path);
            }

            $file = $request->file('profile_image');
            $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
            if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
                $ext = 'png';
            }

            $directory = "users/{$user->id}";
            $filename = "avatar.{$ext}";
            Storage::disk('public')->putFileAs($directory, $file, $filename);
            $user->profile_image_path = "{$directory}/{$filename}";
        }

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($canManageOrganization && filled($validated['organization_name'] ?? null) && $user->organization_id) {
            $organization = Organization::query()
                ->whereKey($user->organization_id)
                ->first();

            if ($organization && $organization->name !== $validated['organization_name']) {
                $organization->name = $validated['organization_name'];
                $organization->save();

                AuditLogger::record($user, 'organization.profile_update', $organization, [
                    'name' => $organization->name,
                ]);
            }
        }

        return Redirect::route('admin.profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current-password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
