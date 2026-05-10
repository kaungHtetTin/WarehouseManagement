<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('voucher_item_id')->nullable()->constrained('voucher_items')->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('currency', 8)->default('MMK');
            $table->enum('payment_method', ['CASH', 'TRANSFER', 'OTHER']);
            $table->timestamp('paid_at');
            $table->string('reference_no', 128)->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'voucher_id', 'paid_at'], 'vp_org_voucher_paid_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_payments');
    }
};
