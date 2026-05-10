<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Run demo tenant seeding with `php artisan db:seed`
    |--------------------------------------------------------------------------
    |
    | When true, DatabaseSeeder will also run DemoDataSeeder after system data.
    | You can always run demo seeding alone: php artisan db:seed --class=DemoDataSeeder
    |
    */
    'seed_with_database_seeder' => filter_var(env('SEED_DEMO', false), FILTER_VALIDATE_BOOLEAN),

    'organization_code' => env('DEMO_ORG_CODE', 'demo-seed'),
    'organization_name' => env('DEMO_ORG_NAME', 'Demo Logistics Ltd'),
    'default_locale' => env('DEMO_ORG_LOCALE', 'mm'),

    'admin_name' => env('DEMO_ADMIN_NAME', 'Demo Admin'),
    'admin_email' => env('DEMO_ADMIN_EMAIL', 'admin@demo.test'),
    'admin_password' => env('DEMO_ADMIN_PASSWORD', 'password'),

];
