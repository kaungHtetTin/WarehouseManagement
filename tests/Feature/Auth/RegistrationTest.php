<?php

namespace Tests\Feature\Auth;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Providers\RouteServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/admin/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        Permission::query()->create([
            'code' => 'warehouses.view',
            'name' => 'View warehouses',
            'module' => 'warehouse',
        ]);

        $response = $this->post('/admin/register', [
            'organization_name' => 'Test Org',
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(RouteServiceProvider::HOME);

        $user = User::query()->where('email', 'test@example.com')->firstOrFail();
        $role = Role::query()
            ->where('organization_id', $user->organization_id)
            ->where('code', 'super_admin')
            ->first();

        $this->assertNotNull($role);
        $this->assertTrue($user->roles()->whereKey($role->id)->exists());
        $this->assertTrue($role->permissions()->where('code', 'users.manage')->exists());
        $this->assertTrue($role->permissions()->where('code', 'public_page.manage')->exists());
    }
}
