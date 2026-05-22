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

        $locale = $request->session()->get('locale')
            ?? $request->cookie('locale')
            ?? config('app.locale', $fallback);

        $locale = (string) $locale;

        if (! in_array($locale, $supportedLocales, true)) {
            $locale = $fallback;
        }

        app()->setLocale($locale);

        return $next($request);
    }
}

