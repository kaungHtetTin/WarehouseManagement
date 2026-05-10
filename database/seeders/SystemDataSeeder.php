<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Platform-wide catalog: permissions (and future global reference data).
 * Safe to run in every environment; idempotent.
 */
class SystemDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PermissionSeeder::class);
    }
}
