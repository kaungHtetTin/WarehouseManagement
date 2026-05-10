<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->string('vehicle_no');
            $table->string('vehicle_type', 64);
            $table->decimal('capacity_weight', 12, 3)->nullable();
            $table->decimal('capacity_volume', 12, 3)->nullable();
            $table->enum('status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE'])->default('ACTIVE');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['organization_id', 'vehicle_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
