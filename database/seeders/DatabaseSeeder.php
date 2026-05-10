<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * System data (permissions, etc.) always runs.
     * Demo tenant data runs when SEED_DEMO=true or config demo.seed_with_database_seeder is true.
     */
    public function run(): void
    {
        $this->call(SystemDataSeeder::class);

        if (config('demo.seed_with_database_seeder')) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
