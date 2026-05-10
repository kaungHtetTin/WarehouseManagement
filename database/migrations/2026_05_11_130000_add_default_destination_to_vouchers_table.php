<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->foreignId('default_to_warehouse_id')->nullable()->after('remark')->constrained('warehouses')->nullOnDelete();
            $table->string('default_to_city', 128)->nullable()->after('default_to_warehouse_id');
            $table->string('default_to_address_line1', 500)->nullable()->after('default_to_city');
            $table->string('default_to_address_line2', 500)->nullable()->after('default_to_address_line1');
            $table->string('default_to_township', 128)->nullable()->after('default_to_address_line2');
            $table->string('default_to_region', 128)->nullable()->after('default_to_township');
            $table->string('default_to_postal_code', 32)->nullable()->after('default_to_region');
            $table->string('default_recipient_name', 255)->nullable()->after('default_to_postal_code');
            $table->string('default_recipient_phone', 64)->nullable()->after('default_recipient_name');
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropForeign(['default_to_warehouse_id']);
            $table->dropColumn([
                'default_to_warehouse_id',
                'default_to_city',
                'default_to_address_line1',
                'default_to_address_line2',
                'default_to_township',
                'default_to_region',
                'default_to_postal_code',
                'default_recipient_name',
                'default_recipient_phone',
            ]);
        });
    }
};
