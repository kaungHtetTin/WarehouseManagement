<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

class AuditLogger
{
    public static function record(
        ?User $actor,
        string $action,
        ?Model $subject = null,
        array $properties = [],
    ): void {
        AuditLog::query()->create([
            'organization_id' => $actor?->organization_id,
            'user_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject ? $subject->getMorphClass() : null,
            'subject_id' => $subject?->getKey(),
            'properties' => $properties === [] ? null : $properties,
            'ip_address' => Request::ip(),
            'user_agent' => self::truncateUserAgent(Request::userAgent()),
            'created_at' => now(),
        ]);
    }

    private static function truncateUserAgent(?string $userAgent): ?string
    {
        if ($userAgent === null) {
            return null;
        }

        return mb_substr($userAgent, 0, 512);
    }
}
