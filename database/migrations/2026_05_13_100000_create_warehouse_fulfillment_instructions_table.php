<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouse_fulfillment_instructions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();
            $table->foreignId('trip_item_id')->nullable()->constrained('trip_items')->nullOnDelete();
            $table->foreignId('voucher_item_id')->constrained('voucher_items')->cascadeOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->decimal('qty_received', 14, 3)->default(0);
            $table->decimal('qty_dispatched', 14, 3)->default(0);
            $table->enum('status', ['PENDING_ACTION', 'COMPLETED'])->default('PENDING_ACTION');
            $table->enum('next_action_type', ['HOLD', 'FORWARD_TO_WAREHOUSE', 'OWNER_PICKUP', 'DIRECT_DELIVERY'])->nullable();
            $table->foreignId('next_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->text('note')->nullable();
            $table->foreignId('last_updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'warehouse_id', 'status'], 'wfi_org_wh_status_idx');
            $table->index(['organization_id', 'voucher_item_id'], 'wfi_org_vi_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_fulfillment_instructions');
    }
};

