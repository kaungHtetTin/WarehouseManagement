<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $defaults = [
            ['scope' => 'VOUCHER', 'direction' => 'INCOME', 'name' => 'Voucher Payment', 'sort_order' => 10],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Salary', 'sort_order' => 10],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Rent', 'sort_order' => 20],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Utilities', 'sort_order' => 30],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Internet', 'sort_order' => 40],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Office supplies', 'sort_order' => 50],
            ['scope' => 'GENERAL', 'direction' => 'INCOME', 'name' => 'Other income', 'sort_order' => 900],
            ['scope' => 'GENERAL', 'direction' => 'EXPENSE', 'name' => 'Other expense', 'sort_order' => 910],
            ['scope' => 'TRIP_COST', 'direction' => 'EXPENSE', 'name' => 'Fuel', 'sort_order' => 10],
            ['scope' => 'TRIP_COST', 'direction' => 'EXPENSE', 'name' => 'Toll', 'sort_order' => 20],
        ];

        foreach (DB::table('organizations')->pluck('id') as $organizationId) {
            foreach ($defaults as $row) {
                $existing = DB::table('finance_categories')
                    ->where('organization_id', $organizationId)
                    ->where('scope', $row['scope'])
                    ->where('name', $row['name'])
                    ->first();

                if ($existing) {
                    DB::table('finance_categories')
                        ->where('id', $existing->id)
                        ->update([
                            'direction' => $row['direction'],
                            'status' => 'ACTIVE',
                            'sort_order' => (int) $row['sort_order'],
                            'deleted_at' => null,
                            'updated_at' => $now,
                        ]);

                    continue;
                }

                DB::table('finance_categories')->insert([
                    'organization_id' => $organizationId,
                    'scope' => $row['scope'],
                    'direction' => $row['direction'],
                    'name' => $row['name'],
                    'status' => 'ACTIVE',
                    'sort_order' => (int) $row['sort_order'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        //
    }
};
