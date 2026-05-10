<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_confirmations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('trip_item_id')->constrained('trip_items')->cascadeOnDelete();
            $table->decimal('received_qty', 14, 3);
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('received_by_name', 255)->nullable();
            $table->timestamp('received_at');
            $table->text('note')->nullable();
            $table->enum('delivery_status', ['FULL', 'PARTIAL', 'REJECTED']);
            $table->timestamps();
            $table->index(['organization_id', 'trip_item_id'], 'delivery_confirmations_org_trip_item_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_confirmations');
    }
};
