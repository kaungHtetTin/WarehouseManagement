<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserHasPermission
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'You do not have access to this resource.');
        }

        $candidates = array_values(array_filter(array_map('trim', explode('|', $permission))));
        if ($candidates === []) {
            abort(403, 'You do not have access to this resource.');
        }

        foreach ($candidates as $code) {
            if ($user->hasPermission($code)) {
                return $next($request);
            }
        }

        abort(403, 'You do not have access to this resource.');
    }
}
