<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if (Schema::hasColumn('warehouses', 'address')) {
            DB::statement('ALTER TABLE `warehouses` MODIFY `address` VARCHAR(255) NULL');
        }

        if (Schema::hasColumn('warehouses', 'code')) {
            DB::statement('ALTER TABLE `warehouses` MODIFY `code` VARCHAR(255) NULL');
        }
    }

    public function down(): void
    {
        // Optional warehouse fields stay nullable in the baseline schema.
    }
};
