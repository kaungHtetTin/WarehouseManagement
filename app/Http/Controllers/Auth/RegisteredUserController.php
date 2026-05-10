<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Permission;
use App\Services\Tenant\TenantRoleBootstrapper;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use App\Providers\RouteServiceProvider;
use App\Services\Audit\AuditLogger;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'organization_name' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user = DB::transaction(function () use ($request) {
            if (! Permission::query()->exists()) {
                app(PermissionSeeder::class)->run();
            }

            $organizationCode = Str::slug($request->organization_name).'-'.Str::lower(Str::random(6));

            $organization = Organization::query()->create([
                'name' => $request->organization_name,
                'code' => $organizationCode,
                'default_locale' => 'mm',
            ]);

            $user = User::query()->create([
                'organization_id' => $organization->id,
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'status' => 'ACTIVE',
            ]);

            $tenantRoles = app(TenantRoleBootstrapper::class)->bootstrap($organization->id);
            $user->roles()->sync([$tenantRoles['super_admin']->id]);

            AuditLogger::record($user, 'auth.register', $user, [
                'organization_id' => $organization->id,
                'organization_name' => $organization->name,
            ]);

            return $user;
        });

        event(new Registered($user));

        Auth::login($user);

        return redirect(RouteServiceProvider::HOME);
    }
}
