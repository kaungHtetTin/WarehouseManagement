import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link, router, usePage } from '@inertiajs/react';

export default function Guest({ children }) {
    const { i18n } = usePage().props;
    const locale = i18n?.locale ?? 'en';
    const supportedLocales = i18n?.supported_locales ?? { en: 'English' };
    const setLocaleUrl = i18n?.set_locale_url;

    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gray-100">
            <div>
                <Link href="/">
                    <ApplicationLogo className="w-20 h-20 fill-current text-gray-500" />
                </Link>
            </div>

            <div className="w-full sm:max-w-md mt-6 px-6 py-4 bg-white shadow-md overflow-hidden sm:rounded-lg">
                {setLocaleUrl && (
                    <div className="flex justify-end mb-3">
                        <select
                            value={locale}
                            onChange={(e) => router.post(setLocaleUrl, { locale: e.target.value }, { preserveScroll: true, preserveState: true })}
                            className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm text-sm"
                        >
                            {Object.entries(supportedLocales).map(([code, label]) => (
                                <option key={code} value={code}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
