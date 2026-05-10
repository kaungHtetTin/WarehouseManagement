<?php

namespace App\Support;

final class VoucherLineFreight
{
    /**
     * Prefer an explicitly submitted freight amount; otherwise derive rate × qty when both are usable.
     */
    public static function resolveAmount(float $qty, mixed $freightRate, mixed $freightAmount): ?float
    {
        $explicit = self::toNullableFloat($freightAmount);
        if ($explicit !== null) {
            return round($explicit, 2);
        }

        $rate = self::toNullableFloat($freightRate);
        if ($qty > 0 && $rate !== null && $rate >= 0) {
            return round($rate * $qty, 2);
        }

        return null;
    }

    private static function toNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }
}
