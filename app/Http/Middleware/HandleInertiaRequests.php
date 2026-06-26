<?php

namespace App\Http\Middleware;

use App\Models\Voucher;
use App\Services\Tenant\OperationalWarehouseContext;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $path = parse_url(url('/'), PHP_URL_PATH) ?: '';
        $locale = app()->getLocale();
        $fallbackLocale = (string) config('app.fallback_locale', 'en');
        $supportedLocales = (array) config('app.supported_locales', ['en' => 'English']);
        $translations = $this->loadJsonTranslations($locale);
        $fallbackTranslations = $locale === $fallbackLocale ? $translations : $this->loadJsonTranslations($fallbackLocale);

        return array_merge(parent::share($request), [
            'app_url' => config('app.url'),
            'admin_app_url' => config('app.admin_app_url'),
            'app_base' => $path,
            'i18n' => [
                'locale' => $locale,
                'fallback_locale' => $fallbackLocale,
                'supported_locales' => $supportedLocales,
                'translations' => $translations,
                'fallback_translations' => $fallbackTranslations,
                'set_locale_url' => url('/locale'),
            ],
            'auth' => [
                'user' => $request->user(),
                'permission_codes' => fn () => $request->user()?->allPermissionCodes() ?? [],
            ],
            'nav_counts' => fn () => [
                'vouchers_pending' => $this->vouchersPendingCount($request),
                'trips_pending' => $this->tripsPendingCount($request),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }

    private function loadJsonTranslations(string $locale): array
    {
        $path = lang_path($locale.'.json');
        if (! is_file($path)) {
            return [];
        }

        $raw = file_get_contents($path);
        if (! is_string($raw) || $raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function vouchersPendingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('vouchers.view') && ! $user->hasPermission('vouchers.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->organizationWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        return Voucher::query()
            ->where('organization_id', $user->organization_id)
            ->where('status', '!=', 'DRAFT')
            ->whereIn('source_warehouse_id', $allowedIds)
            ->whereIn('payment_status', ['UNPAID', 'PARTIAL'])
            ->count();
    }

    private function tripsPendingCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        if (! $user->hasPermission('trips.view') && ! $user->hasPermission('trips.manage')) {
            return 0;
        }

        if ($user->organization_id === null) {
            return 0;
        }

        /** @var OperationalWarehouseContext $ctx */
        $ctx = app(OperationalWarehouseContext::class);
        $allowedIds = $ctx->organizationWarehouseIds($user);
        if ($allowedIds === []) {
            return 0;
        }

        return \App\Models\Trip::query()
            ->where('organization_id', $user->organization_id)
            ->whereIn('source_warehouse_id', $allowedIds)
            ->whereNotIn('status', ['COMPLETED', 'CANCELLED'])
            ->count();
    }
}
