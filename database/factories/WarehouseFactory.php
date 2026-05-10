<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
class WarehouseFactory extends Factory
{
    protected $model = Warehouse::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'code' => strtoupper($this->faker->unique()->bothify('WH-####')),
            'name' => $this->faker->company().' Warehouse',
            'city' => $this->faker->city(),
            'address' => $this->faker->streetAddress(),
            'phone' => $this->faker->optional()->phoneNumber(),
            'is_main' => false,
            'status' => 'ACTIVE',
        ];
    }
}
