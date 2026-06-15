export function formatDecimal(value, digits = 2, fallback = '-') {
    if (value == null || value === '') {
        return fallback;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(n);
}

export function formatDecimalInput(value, digits = 2, fallback = '') {
    if (value == null || value === '') {
        return fallback;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return n.toFixed(digits);
}

export function roundDecimal(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
}
