import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';

const el = document.getElementById('app');

const normalizeDuplicatedBasePath = (pathname, base) => {
    if (!pathname || !base || base === '/') {
        return pathname;
    }

    const cleanBase = `/${String(base).replace(/^\/+|\/+$/g, '')}`;
    if (cleanBase === '/') {
        return pathname;
    }

    const doubled = `${cleanBase}${cleanBase}`;
    let nextPath = pathname;

    while (nextPath === doubled || nextPath.startsWith(`${doubled}/`)) {
        nextPath = nextPath.substring(cleanBase.length);
    }

    return nextPath;
};

const normalizeDuplicatedBase = (url, base) => {
    if (!url) return url;

    const isAbsolute = /^https?:\/\//i.test(url);

    try {
        const parsed = new URL(url, window.location.origin);
        parsed.pathname = normalizeDuplicatedBasePath(parsed.pathname, base);
        return isAbsolute
            ? `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
            : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
};

const normalizeCurrentBrowserUrl = (base) => {
    const correctedPath = normalizeDuplicatedBasePath(window.location.pathname, base);
    if (correctedPath !== window.location.pathname) {
        window.history.replaceState(null, '', `${correctedPath}${window.location.search}${window.location.hash}`);
    }
};

const coerceNavigationUrl = (url, base) => {
    if (url === undefined || url === null || url === '') return url;
    const raw = String(url);
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const normalizedInput = hasScheme || raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
    return normalizeDuplicatedBase(normalizedInput, base);
};

const buildGetUrl = (rawUrl, data = {}) => {
    const parsed = new URL(rawUrl, window.location.origin);
    const params = new URLSearchParams(parsed.search);

    Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, String(value));
        }
    });

    parsed.search = params.toString() ? `?${params.toString()}` : '';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

if (el && el.dataset.page) {
    createInertiaApp({
        page: JSON.parse(el.dataset.page),
        resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
        setup({ el, App, props }) {
            const base = props.initialPage.props.app_base || '';
            props.initialPage.url = normalizeDuplicatedBase(props.initialPage.url, base);
            normalizeCurrentBrowserUrl(base);

            if (!window.__forceBrowserGetNavigation && typeof router.visit === 'function') {
                const originalVisit = router.visit.bind(router);
                window.__forceBrowserGetNavigation = true;

                router.visit = (url, options = {}) => {
                    const method = String(options?.method || 'get').toLowerCase();
                    const rawUrl = typeof url === 'string' ? url : (url?.url || String(url));
                    const withQuery = method === 'get' ? buildGetUrl(rawUrl, options?.data || {}) : rawUrl;
                    const target = coerceNavigationUrl(withQuery, base);

                    if (method === 'get') {
                        window.location.assign(target);
                        return;
                    }

                    return originalVisit(target, options);
                };
            }

            if (!window.__historyUrlGuardBound) {
                const originalPushState = window.history.pushState.bind(window.history);
                const originalReplaceState = window.history.replaceState.bind(window.history);

                window.history.pushState = (state, title, url) => originalPushState(state, title, coerceNavigationUrl(url, base));
                window.history.replaceState = (state, title, url) => originalReplaceState(state, title, coerceNavigationUrl(url, base));
                window.__historyUrlGuardBound = true;
            }

            if (!window.__inertiaUrlGuardBound) {
                window.__inertiaUrlGuardBound = true;
                router.on('navigate', () => normalizeCurrentBrowserUrl(base));
            }

            createRoot(el).render(<App {...props} />);
        },
        progress: {
            color: '#4B5563',
        },
    });
}
