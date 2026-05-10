<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('organization_id')->nullable()->after('id')->constrained('organizations')->nullOnDelete();
            $table->boolean('is_platform_admin')->default(false)->after('password');
            $table->enum('status', ['ACTIVE', 'INACTIVE'])->default('ACTIVE')->after('is_platform_admin');
            $table->timestamp('last_login_at')->nullable()->after('remember_token');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_email_unique');
            $table->unique(['organization_id', 'email'], 'users_organization_email_unique');
        });

        DB::table('users')->whereNull('status')->update(['status' => 'ACTIVE']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_organization_email_unique');
            $table->unique('email');
            $table->dropConstrainedForeignId('organization_id');
            $table->dropColumn(['is_platform_admin', 'status', 'last_login_at']);
        });
    }
};

