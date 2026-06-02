<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('warehouses', 'code')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE `warehouses` MODIFY `code` VARCHAR(255) NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('warehouses', 'code')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE `warehouses` SET `code` = CONCAT('warehouse-', `id`) WHERE `code` IS NULL");
            DB::statement('ALTER TABLE `warehouses` MODIFY `code` VARCHAR(255) NOT NULL');
        }
    }
};
