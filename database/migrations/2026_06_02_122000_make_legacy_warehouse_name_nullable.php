<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql' || ! Schema::hasColumn('warehouses', 'name')) {
            return;
        }

        DB::statement('ALTER TABLE `warehouses` MODIFY `name` VARCHAR(255) NULL');
    }

    public function down(): void
    {
        // Legacy warehouse names remain optional because city is the display field.
    }
};
