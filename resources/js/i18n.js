import { usePage } from '@inertiajs/react';

const interpolate = (template, replacements) => {
    if (!template || !replacements) return template;

    return String(template).replace(/:([A-Za-z0-9_]+)/g, (match, key) => {
        if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
            return match;
        }
        return String(replacements[key]);
    });
};

export const useT = () => {
    const { i18n } = usePage().props;
    const translations = i18n?.translations ?? {};
    const fallbackTranslations = i18n?.fallback_translations ?? {};

    return (key, replacements) => {
        const k = String(key);
        const value =
            (Object.prototype.hasOwnProperty.call(translations, k) && translations[k]) ||
            (Object.prototype.hasOwnProperty.call(fallbackTranslations, k) && fallbackTranslations[k]) ||
            k;

        return interpolate(value, replacements);
    };
};

