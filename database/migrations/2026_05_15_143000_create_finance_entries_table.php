<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->enum('scope', ['TRIP_COST', 'VOUCHER', 'GENERAL'])->default('GENERAL');
            $table->enum('direction', ['INCOME', 'EXPENSE']);
            $table->foreignId('category_id')->nullable()->constrained('finance_categories')->nullOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('currency', 8)->default('MMK');
            $table->timestamp('occurred_at');
            $table->string('note', 2000)->nullable();
            $table->string('reference_type', 120)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->enum('source', ['MANUAL', 'SYSTEM'])->default('MANUAL');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'occurred_at'], 'fe_org_occurred_idx');
            $table->index(['organization_id', 'scope', 'occurred_at'], 'fe_org_scope_occurred_idx');
            $table->index(['organization_id', 'direction', 'occurred_at'], 'fe_org_direction_occurred_idx');
            $table->index(['organization_id', 'reference_type', 'reference_id'], 'fe_org_ref_idx');
            $table->index(['organization_id', 'warehouse_id', 'occurred_at'], 'fe_org_wh_occurred_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_entries');
    }
};
