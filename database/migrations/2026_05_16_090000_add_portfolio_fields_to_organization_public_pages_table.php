<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_public_pages', function (Blueprint $table) {
            $table->json('kpis')->nullable();
            $table->json('services')->nullable();
            $table->json('gallery')->nullable();
            $table->json('faqs')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organization_public_pages', function (Blueprint $table) {
            $table->dropColumn(['kpis', 'services', 'gallery', 'faqs']);
        });
    }
};

