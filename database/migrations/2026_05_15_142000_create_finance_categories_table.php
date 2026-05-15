<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->enum('scope', ['TRIP_COST', 'VOUCHER', 'GENERAL'])->default('GENERAL');
            $table->enum('direction', ['INCOME', 'EXPENSE', 'BOTH'])->default('BOTH');
            $table->string('name', 255);
            $table->enum('status', ['ACTIVE', 'INACTIVE'])->default('ACTIVE');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['organization_id', 'scope', 'name'], 'fc_org_scope_name_unique');
            $table->index(['organization_id', 'scope', 'status'], 'fc_org_scope_status_idx');
            $table->index(['organization_id', 'direction', 'status'], 'fc_org_direction_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_categories');
    }
};

