import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
    return Math.round(toNumber(value));
}

function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(roundMoney(value));
}

function formatQty(value) {
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    }).format(toNumber(value));
}

function compactText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function truncateText(value, maxLength) {
    const text = compactText(value);
    if (!text || text.length <= maxLength) {
        return text || '—';
    }

    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function makeDivider(columns) {
    return '-'.repeat(columns);
}

export function buildVoucherEscPosReceipt({ voucher, template = {}, trackingUrl, paperWidth = 80 }) {
    const columns = paperWidth === 58 ? 32 : 48;
    const itemNameWidth = paperWidth === 58 ? 14 : 22;
    const qtyWidth = 8;
    const amountWidth = paperWidth === 58 ? 10 : 14;
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns,
        codepageMapping: 'epson',
    });

    const items = Array.isArray(voucher?.items) ? voucher.items : [];
    const payments = Array.isArray(voucher?.payments) ? voucher.payments : [];
    const freightTotal = items.reduce((sum, item) => sum + toNumber(item?.freight_amount), 0);
    const paidTotal = payments.reduce((sum, payment) => sum + toNumber(payment?.amount), 0);
    const balance = Math.max(0, freightTotal - paidTotal);
    const headerTitle = compactText(template?.header_title) || 'Voucher';
    const headerSubtitle = compactText(template?.header_subtitle);
    const contactParts = [compactText(template?.contact_phone), compactText(template?.contact_email), compactText(template?.contact_address)].filter(Boolean);
    const fromWarehouse = compactText(voucher?.source_warehouse?.display_name || voucher?.source_warehouse?.city || voucher?.sourceWarehouse?.city) || '—';
    const toWarehouse = compactText(voucher?.default_to_warehouse?.display_name || voucher?.defaultToWarehouse?.city) || '—';
    const recipient = compactText(voucher?.default_recipient_name) || '—';
    const recipientPhone = compactText(voucher?.default_recipient_phone) || '—';
    const destinationAddress = compactText(voucher?.default_to_address_line1 || voucher?.default_to_address) || '—';
    const remark = compactText(voucher?.default_destination_remark || voucher?.remark) || '—';
    const showPaymentStatus = Boolean(template?.show_payment_status);
    const showFooterNote = compactText(template?.footer_note);

    encoder.initialize().codepage('auto');

    encoder.align('center').bold(true).width(2).height(2).line(headerTitle);
    encoder.width(1).height(1).bold(false);

    if (headerSubtitle) {
        encoder.bold(true).line(headerSubtitle).bold(false);
    }

    if (contactParts.length > 0) {
        for (const part of contactParts) {
            encoder.line(part);
        }
    }

    encoder.newline();
    encoder.bold(true).line(`Invoice #${compactText(voucher?.voucher_no) || '—'}`).bold(false);
    encoder.line(`Date: ${compactText(voucher?.voucher_date)?.slice(0, 10) || '—'}`);
    encoder.line(makeDivider(columns));

    encoder.align('left');
    encoder.line(`From: ${fromWarehouse}`);
    encoder.line(`Dest: ${toWarehouse}`);
    encoder.line(`Customer: ${recipient}`);
    encoder.line(`Phone: ${recipientPhone}`);
    encoder.line(`Address: ${destinationAddress}`);
    if (showPaymentStatus) {
        encoder.line(`Status: ${compactText(voucher?.payment_status) || '—'}`);
    }
    if (remark && remark !== '—') {
        encoder.line(`Remark: ${remark}`);
    }

    encoder.line(makeDivider(columns));
    encoder.bold(true).table(
        [
            { width: itemNameWidth, align: 'left' },
            { width: qtyWidth, align: 'right' },
            { width: amountWidth, align: 'right' },
        ],
        [['Item', 'Qty', 'Amt']],
    ).bold(false);
    encoder.line(makeDivider(columns));

    if (items.length === 0) {
        encoder.line('No items');
    } else {
        encoder.table(
            [
                { width: itemNameWidth, align: 'left' },
                { width: qtyWidth, align: 'right' },
                { width: amountWidth, align: 'right' },
            ],
            items.map((item) => [
                truncateText(item?.product?.name || item?.product_name || '—', itemNameWidth),
                formatQty(item?.qty),
                formatMoney(item?.freight_amount),
            ]),
        );
    }

    encoder.line(makeDivider(columns));
    encoder.table(
        [
            { width: columns - 14, align: 'left' },
            { width: 14, align: 'right' },
        ],
        [
            ['Amount', formatMoney(freightTotal)],
            ['Paid', formatMoney(paidTotal)],
            ['Balance', formatMoney(balance)],
        ],
    );
    encoder.line(makeDivider(columns));

    encoder.align('center').newline();

    const barcodeValue = compactText(voucher?.voucher_no);
    if (barcodeValue) {
        try {
            encoder.barcode(barcodeValue, 'code128', { height: 60, width: 2, text: true });
        } catch {
            encoder.bold(true).line(barcodeValue).bold(false);
        }
    }

    if (compactText(trackingUrl)) {
        try {
            encoder.qrcode(compactText(trackingUrl), { model: 2, size: paperWidth === 58 ? 5 : 6, errorlevel: 'm' });
            encoder.line('Scan to track voucher');
        } catch {
            encoder.line(compactText(trackingUrl));
        }
    }

    if (showFooterNote) {
        encoder.newline().line(showFooterNote);
    }

    encoder.newline().bold(true).line('Thank you').bold(false).newline(3).cut();

    return encoder.encode();
}
