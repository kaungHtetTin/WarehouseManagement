<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('voucher_no', 64);
            $table->date('voucher_date');
            $table->foreignId('source_warehouse_id')->constrained('warehouses');
            $table->foreignId('merchant_id')->constrained('merchants');
            $table->enum('status', [
                'DRAFT',
                'CONFIRMED',
                'LOADING',
                'IN_TRANSIT',
                'PARTIALLY_DELIVERED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED',
            ])->default('DRAFT');
            $table->enum('payment_status', ['UNPAID', 'PARTIAL', 'PAID', 'WAIVED'])->default('UNPAID');
            $table->decimal('total_qty', 14, 3)->default(0);
            $table->decimal('total_amount', 14, 2)->nullable();
            $table->text('remark')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['organization_id', 'voucher_no'], 'vouchers_org_no_unique');
            $table->index(['organization_id', 'voucher_date'], 'vouchers_org_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
    }
};
