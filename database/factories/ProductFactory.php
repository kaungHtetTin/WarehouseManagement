<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Organization;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'category_id' => null,
            'sku' => strtoupper($this->faker->bothify('SKU-####')),
            'name' => $this->faker->unique()->words(3, true),
            'unit' => $this->faker->randomElement(['piece', 'bag', 'kg']),
            'default_weight' => $this->faker->randomFloat(3, 0, 100),
            'status' => 'ACTIVE',
        ];
    }

    public function withCategory(Category $category): self
    {
        return $this->state(fn () => [
            'organization_id' => $category->organization_id,
            'category_id' => $category->id,
        ]);
    }
}
