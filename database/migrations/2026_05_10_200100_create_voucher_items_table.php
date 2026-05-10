<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->unsignedInteger('line_no');
            $table->foreignId('product_id')->constrained('products');
            $table->string('description')->nullable();
            $table->foreignId('from_warehouse_id')->constrained('warehouses');
            $table->foreignId('to_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->string('to_city')->nullable();
            $table->decimal('qty', 14, 3);
            $table->decimal('loaded_qty', 14, 3)->default(0);
            $table->decimal('delivered_qty', 14, 3)->default(0);
            $table->string('unit', 32);
            $table->decimal('freight_rate', 14, 2)->nullable();
            $table->decimal('freight_amount', 14, 2)->nullable();
            $table->enum('payment_status', ['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])->default('UNPAID');
            $table->boolean('is_fragile')->default(false);
            $table->timestamps();
            $table->index(['organization_id', 'voucher_id'], 'vi_org_voucher_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_items');
    }
};
