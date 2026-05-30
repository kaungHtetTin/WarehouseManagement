<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $request->user();
        $organizationId = $actor->organization_id;
        abort_if($organizationId === null, 404);

        $search = trim((string) $request->query('search', ''));
        $action = trim((string) $request->query('action', 'all'));
        $userFilter = trim((string) $request->query('user_id', 'all'));
        $from = trim((string) $request->query('from', now()->subDays(30)->toDateString()));
        $to = trim((string) $request->query('to', now()->toDateString()));
        $perPage = (int) $request->query('per_page', 50);
        if (! in_array($perPage, [25, 50, 100], true)) {
            $perPage = 50;
        }

        $fromDate = $this->parseDate($from, now()->subDays(30)->startOfDay())->startOfDay();
        $toDate = $this->parseDate($to, now()->endOfDay())->endOfDay();
        if ($fromDate->greaterThan($toDate)) {
            [$fromDate, $toDate] = [$toDate->copy()->startOfDay(), $fromDate->copy()->endOfDay()];
        }

        $baseQuery = AuditLog::query()
            ->where('organization_id', $organizationId);

        $actions = (clone $baseQuery)
            ->select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action')
            ->map(fn ($value) => (string) $value)
            ->values();

        $users = User::query()
            ->where('organization_id', $organizationId)
            ->whereIn('id', (clone $baseQuery)->whereNotNull('user_id')->select('user_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
            ])
            ->values();

        $selectedUserId = null;
        if ($userFilter !== '' && $userFilter !== 'all') {
            $selectedUserId = (int) $userFilter;
        }

        $query = AuditLog::query()
            ->where('organization_id', $organizationId)
            ->with('user:id,name')
            ->whereBetween('created_at', [$fromDate, $toDate]);

        if ($action !== '' && $action !== 'all') {
            $query->where('action', $action);
        }

        if ($selectedUserId !== null && $selectedUserId > 0) {
            $query->where('user_id', $selectedUserId);
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($inner) use ($like) {
                $inner->where('action', 'like', $like)
                    ->orWhere('subject_type', 'like', $like)
                    ->orWhere('subject_id', 'like', $like)
                    ->orWhere('ip_address', 'like', $like)
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where('name', 'like', $like))
                    ->orWhereRaw('CAST(properties AS CHAR) like ?', [$like]);
            });
        }

        $logs = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(function (AuditLog $log) {
                $properties = is_array($log->properties) ? $log->properties : [];

                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'subject_type' => $this->subjectLabel($log->subject_type),
                    'subject_id' => $log->subject_id,
                    'user_name' => $log->user?->name ?? 'System',
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at?->toIso8601String(),
                    'details' => $this->summarizeProperties($properties),
                    'properties' => $properties,
                ];
            });

        return Inertia::render('Admin/System/ActivityLogs', [
            'logs' => $logs,
            'filters' => [
                'search' => $search,
                'action' => $action,
                'user_id' => $selectedUserId !== null ? (string) $selectedUserId : 'all',
                'from' => $fromDate->toDateString(),
                'to' => $toDate->toDateString(),
                'per_page' => $perPage,
            ],
            'actions' => $actions,
            'users' => $users,
        ]);
    }

    private function parseDate(string $value, Carbon $fallback): Carbon
    {
        if ($value === '') {
            return $fallback->copy();
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return $fallback->copy();
        }
    }

    private function subjectLabel(?string $subjectType): ?string
    {
        if ($subjectType === null || trim($subjectType) === '') {
            return null;
        }

        $base = str_contains($subjectType, '\\')
            ? class_basename($subjectType)
            : $subjectType;

        return trim((string) preg_replace('/(?<!^)([A-Z])/', ' $1', $base));
    }

    private function summarizeProperties(array $properties): string
    {
        if ($properties === []) {
            return '—';
        }

        $parts = collect($properties)
            ->map(function ($value, $key) {
                if (is_array($value)) {
                    $value = implode(', ', array_map(fn ($item) => is_scalar($item) ? (string) $item : '[complex]', $value));
                } elseif (is_bool($value)) {
                    $value = $value ? 'true' : 'false';
                } elseif ($value === null) {
                    $value = 'null';
                } elseif (! is_scalar($value)) {
                    $value = '[complex]';
                }

                $label = trim((string) preg_replace('/[_\.]+/', ' ', (string) $key));

                return $label !== '' ? $label.': '.$value : (string) $value;
            })
            ->filter(fn ($value) => trim((string) $value) !== '')
            ->values();

        if ($parts->isEmpty()) {
            return '—';
        }

        return (string) $parts->take(4)->implode(' | ');
    }
}
