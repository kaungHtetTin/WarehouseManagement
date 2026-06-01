<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        $supportedLocales = array_keys((array) config('app.supported_locales', ['en' => 'English']));
        $fallback = (string) config('app.fallback_locale', 'en');
        $isPublicVoucherTracking = $request->route()?->named('public.voucher.track') ?? false;

        $locale = $isPublicVoucherTracking
            ? $request->query('locale', 'my')
            : ($request->session()->get('locale')
                ?? $request->cookie('locale')
                ?? config('app.locale', $fallback));

        $locale = is_string($locale) ? $locale : ($isPublicVoucherTracking ? 'my' : $fallback);

        if (! in_array($locale, $supportedLocales, true)) {
            $locale = $isPublicVoucherTracking ? 'my' : $fallback;
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
