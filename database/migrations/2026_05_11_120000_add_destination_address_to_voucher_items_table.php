<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voucher_items', function (Blueprint $table) {
            $table->foreignId('to_warehouse_id')->nullable()->after('from_warehouse_id')->constrained('warehouses')->nullOnDelete();
            $table->string('to_city', 128)->nullable()->after('to_warehouse_id');
            $table->string('to_address_line1', 500)->nullable()->after('to_city');
            $table->string('to_address_line2', 500)->nullable()->after('to_address_line1');
            $table->string('to_township', 128)->nullable()->after('to_address_line2');
            $table->string('to_region', 128)->nullable()->after('to_township');
            $table->string('to_postal_code', 32)->nullable()->after('to_region');
            $table->string('recipient_name', 255)->nullable()->after('to_postal_code');
            $table->string('recipient_phone', 64)->nullable()->after('recipient_name');
        });
    }

    public function down(): void
    {
        Schema::table('voucher_items', function (Blueprint $table) {
            $table->dropForeign(['to_warehouse_id']);
            $table->dropColumn([
                'to_warehouse_id',
                'to_city',
                'to_address_line1',
                'to_address_line2',
                'to_township',
                'to_region',
                'to_postal_code',
                'recipient_name',
                'recipient_phone',
            ]);
        });
    }
};
