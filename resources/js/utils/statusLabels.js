const normalizeStatus = (status) => String(status ?? '').toUpperCase();

const rawStatus = (status) => {
    if (status == null || status === '') {
        return '—';
    }

    return String(status);
};

export function tripStatusLabel(status, t) {
    const key = {
        PLANNED: 'trips.status.planned',
        LOADING: 'trips.status.loading',
        DEPARTED: 'trips.status.departed',
        AT_STOP: 'trips.status.at_stop',
        COMPLETED: 'trips.status.completed',
        CANCELLED: 'trips.status.cancelled',
    }[normalizeStatus(status)];

    return key ? t(key) : rawStatus(status);
}

export function voucherStatusLabel(status, t) {
    const key = {
        DRAFT: 'vouchers.status.draft',
        CONFIRMED: 'vouchers.status.confirmed',
        LOADING: 'vouchers.status.loading',
        LOADED: 'vouchers.status.loaded',
        IN_TRANSIT: 'vouchers.status.in_transit',
        PARTIALLY_DELIVERED: 'vouchers.status.partially_delivered',
        DELIVERED: 'vouchers.status.delivered',
        RETURNED: 'vouchers.status.returned',
        CLOSED: 'vouchers.status.closed',
        CANCELLED: 'vouchers.status.cancelled',
    }[normalizeStatus(status)];

    return key ? t(key) : rawStatus(status);
}

export function voucherPaymentStatusLabel(status, t) {
    const normalized = normalizeStatus(status || 'UNPAID');
    const key = {
        PAID: 'vouchers.payment_status.paid',
        PARTIAL: 'vouchers.payment_status.partial',
        UNPAID: 'vouchers.payment_status.unpaid',
        WAIVED: 'vouchers.payment_status.waived',
    }[normalized];

    return key ? t(key) : rawStatus(status || normalized);
}

export function voucherPaymentChipLabel(status, t) {
    return t('vouchers.chip.payment_status', {
        payment_status: voucherPaymentStatusLabel(status, t),
    });
}
