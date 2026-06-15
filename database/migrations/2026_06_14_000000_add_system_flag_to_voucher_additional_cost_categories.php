<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voucher_additional_cost_categories', function (Blueprint $table) {
            $table->boolean('is_system')->default(false)->index();
        });

        $now = now();
        $defaults = [
            ['name' => 'Labor', 'sort_order' => 10],
            ['name' => 'Tax', 'sort_order' => 20],
        ];

        foreach (DB::table('organizations')->pluck('id') as $organizationId) {
            foreach ($defaults as $row) {
                $existing = DB::table('voucher_additional_cost_categories')
                    ->where('organization_id', $organizationId)
                    ->where('name', $row['name'])
                    ->first();

                if ($existing) {
                    DB::table('voucher_additional_cost_categories')
                        ->where('id', $existing->id)
                        ->update([
                            'status' => 'ACTIVE',
                            'sort_order' => (int) $row['sort_order'],
                            'is_system' => true,
                            'deleted_at' => null,
                            'updated_at' => $now,
                        ]);

                    continue;
                }

                DB::table('voucher_additional_cost_categories')->insert([
                    'organization_id' => $organizationId,
                    'name' => $row['name'],
                    'status' => 'ACTIVE',
                    'sort_order' => (int) $row['sort_order'],
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('voucher_additional_cost_categories', function (Blueprint $table) {
            $table->dropColumn('is_system');
        });
    }
};
