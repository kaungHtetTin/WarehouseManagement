<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE vouchers MODIFY total_weight DECIMAL(14, 2) NULL');
            DB::statement('ALTER TABLE vehicles MODIFY capacity_weight DECIMAL(12, 2) NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE vouchers ALTER COLUMN total_weight TYPE DECIMAL(14, 2)');
            DB::statement('ALTER TABLE vehicles ALTER COLUMN capacity_weight TYPE DECIMAL(12, 2)');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE vouchers MODIFY total_weight DECIMAL(14, 3) NULL');
            DB::statement('ALTER TABLE vehicles MODIFY capacity_weight DECIMAL(12, 3) NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE vouchers ALTER COLUMN total_weight TYPE DECIMAL(14, 3)');
            DB::statement('ALTER TABLE vehicles ALTER COLUMN capacity_weight TYPE DECIMAL(12, 3)');
        }
    }
};
