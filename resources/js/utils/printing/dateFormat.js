function formatDatePrefix(value, preserveSuffix) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return raw;

    const suffix = preserveSuffix ? raw.slice(match[0].length) : '';
    return `${match[3]}-${match[2]}-${match[1]}${suffix}`;
}

export function formatPrintDate(value) {
    return formatDatePrefix(value, false);
}

export function formatPrintDateTime(value) {
    return formatDatePrefix(value, true);
}
