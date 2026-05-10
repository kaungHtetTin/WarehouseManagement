<?php

namespace Tests\Feature\Seeding;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\User;
use Database\Seeders\DemoDataSeeder;
use Database\Seeders\SystemDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seeder_is_idempotent_for_organization(): void
    {
        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class);

        $this->assertSame(1, Organization::query()->where('code', config('demo.organization_code'))->count());
        $this->assertTrue(Permission::query()->exists());
        $this->assertDatabaseHas('users', [
            'email' => config('demo.admin_email'),
        ]);
    }

    public function test_system_seeder_only_inserts_permissions(): void
    {
        $this->seed(SystemDataSeeder::class);

        $this->assertTrue(Permission::query()->exists());
        $this->assertSame(0, Organization::query()->count());
        $this->assertSame(0, User::query()->count());
    }
}
