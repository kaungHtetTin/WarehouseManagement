<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('trip_no', 64);
            $table->foreignId('vehicle_id')->constrained('vehicles');
            $table->string('driver_name')->nullable();
            $table->string('driver_phone', 64)->nullable();
            $table->foreignId('source_warehouse_id')->constrained('warehouses');
            $table->timestamp('departed_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->enum('status', ['PLANNED', 'LOADING', 'DEPARTED', 'AT_STOP', 'COMPLETED', 'CANCELLED'])->default('PLANNED');
            $table->timestamp('manifest_printed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['organization_id', 'trip_no'], 'trips_org_no_unique');
            $table->index(['organization_id', 'status'], 'trips_org_status_idx');
        });

        Schema::create('trip_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('trip_id')->constrained('trips')->cascadeOnDelete();
            $table->unsignedInteger('stop_order');
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->string('location_name')->nullable();
            $table->string('city', 128)->nullable();
            $table->string('address', 500)->nullable();
            $table->timestamp('arrival_time')->nullable();
            $table->timestamp('departure_time')->nullable();
            $table->enum('status', ['PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED'])->default('PENDING');
            $table->timestamps();
            $table->unique(['trip_id', 'stop_order'], 'trip_stops_trip_order_unique');
            $table->index(['organization_id', 'trip_id'], 'trip_stops_org_trip_idx');
        });

        Schema::create('trip_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('trip_id')->constrained('trips')->cascadeOnDelete();
            $table->foreignId('voucher_item_id')->constrained('voucher_items')->cascadeOnDelete();
            $table->foreignId('trip_stop_id')->nullable()->constrained('trip_stops')->nullOnDelete();
            $table->decimal('loaded_qty', 14, 3);
            $table->decimal('delivered_qty', 14, 3)->default(0);
            $table->enum('status', ['LOADED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'RETURNED'])->default('LOADED');
            $table->timestamps();
            $table->index(['organization_id', 'trip_id'], 'trip_items_org_trip_idx');
            $table->index(['organization_id', 'voucher_item_id'], 'trip_items_org_vi_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_items');
        Schema::dropIfExists('trip_stops');
        Schema::dropIfExists('trips');
    }
};
