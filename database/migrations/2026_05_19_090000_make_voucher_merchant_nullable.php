<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE vouchers DROP FOREIGN KEY vouchers_merchant_id_foreign');
        DB::statement('ALTER TABLE vouchers MODIFY merchant_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE vouchers ADD CONSTRAINT vouchers_merchant_id_foreign FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE vouchers DROP FOREIGN KEY vouchers_merchant_id_foreign');
        DB::statement('ALTER TABLE vouchers MODIFY merchant_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE vouchers ADD CONSTRAINT vouchers_merchant_id_foreign FOREIGN KEY (merchant_id) REFERENCES merchants(id)');
    }
};
