import { useEffect, useMemo, useState } from 'react';
import { Box, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import QRCode from 'qrcode';
import { formatPrintDate } from '@/utils/printing/dateFormat';
import { getThermalPaperLayout } from '@/utils/printing/thermalPaper';

function n2(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function formatMoneyAmount(value) {
    const n = n2(value);
    if (n == null) return '—';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatQty(value) {
    const n = n2(value);
    if (n == null) return '—';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}

function safeStr(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function getVoucherPrintCss({ paperSize = 'A4', thermalPaperWidth = 80 } = {}) {
    const isReceipt = String(paperSize || 'A4').toUpperCase() === 'RECEIPT_80';
    const thermalLayout = getThermalPaperLayout(thermalPaperWidth);

    return `
        @page { size: ${isReceipt ? `${thermalLayout.paperWidth}mm auto` : 'A4'}; margin: ${isReceipt ? thermalLayout.pageMargin : '12mm'}; }
        .print-sheet { width: ${isReceipt ? `${thermalLayout.paperWidth}mm` : '210mm'}; max-width: 100%; }
        .kv { display: grid; grid-template-columns: ${isReceipt ? `${thermalLayout.keyColumnWidth}px 1fr` : '140px 1fr'}; gap: 0 ${isReceipt ? thermalLayout.kvColumnGap : '8px'}; }
        .kv .k { color: rgba(0,0,0,0.60); font-size: ${isReceipt ? thermalLayout.keyFontSize : '13px'}; }
        .kv .v { font-size: ${isReceipt ? thermalLayout.valueFontSize : '13px'}; font-weight: 600; }
    `;
}

export default function VoucherPrintableDocument({
    voucher,
    template = {},
    voucherPolicy = '',
    trackingUrl = '',
    paperSize = 'A4',
    thermalPaperWidth = 80,
    className = '',
}) {
    const isReceipt = String(paperSize || 'A4').toUpperCase() === 'RECEIPT_80';
    const thermalLayout = useMemo(() => getThermalPaperLayout(thermalPaperWidth), [thermalPaperWidth]);
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const metaFontSize = isReceipt ? thermalLayout.metaFontSize : '13px';

    const paymentsTotal = useMemo(() => {
        const rows = Array.isArray(voucher?.payments) ? voucher.payments : [];
        let sum = 0;
        for (const row of rows) {
            const n = n2(row?.amount);
            if (n == null) continue;
            sum += n;
        }
        return Math.round(sum * 100) / 100;
    }, [voucher?.payments]);

    const freightTotal = useMemo(() => {
        const items = Array.isArray(voucher?.items) ? voucher.items : [];
        let sum = 0;
        for (const it of items) {
            const n = n2(it?.freight_amount);
            if (n == null) continue;
            sum += n;
        }
        return Math.round(sum * 100) / 100;
    }, [voucher?.items]);

    const totalQty = useMemo(() => {
        const items = Array.isArray(voucher?.items) ? voucher.items : [];
        let sum = 0;
        for (const it of items) {
            const n = n2(it?.qty);
            if (n == null) continue;
            sum += n;
        }
        return Math.round(sum * 1000) / 1000;
    }, [voucher?.items]);

    const fromWarehouseName = voucher?.source_warehouse?.display_name || voucher?.source_warehouse?.city || voucher?.sourceWarehouse?.city || '—';
    const toWarehouseName = voucher?.default_to_warehouse?.display_name || voucher?.defaultToWarehouse?.city || '—';
    const toAddress = safeStr(voucher?.default_to_address_line1) || safeStr(voucher?.default_to_address) || '';
    const headerTitle = safeStr(template?.header_title) || 'Voucher';
    const headerSubtitle = safeStr(template?.header_subtitle);
    const showLogo = Boolean(template?.show_logo);
    const logoUrl = safeStr(template?.logo_url);
    const showContact = Boolean(template?.show_contact);
    const contactPhone = safeStr(template?.contact_phone);
    const contactEmail = safeStr(template?.contact_email);
    const contactAddress = safeStr(template?.contact_address);
    const footerNote = safeStr(template?.footer_note);
    const printableVoucherPolicy = safeStr(voucherPolicy);
    const showPaymentStatus = Boolean(template?.show_payment_status);

    useEffect(() => {
        let cancelled = false;
        const raw = typeof trackingUrl === 'string' ? trackingUrl.trim() : '';

        if (!raw) {
            setQrDataUrl(null);
            return () => {
                cancelled = true;
            };
        }

        QRCode.toDataURL(raw, { margin: 1, width: isReceipt ? thermalLayout.qrPreviewWidth : 260 })
            .then((url) => {
                if (!cancelled) {
                    setQrDataUrl(url);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setQrDataUrl(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [trackingUrl, isReceipt, thermalLayout.qrPreviewWidth]);

    return (
        <Paper className={['print-sheet', className].filter(Boolean).join(' ')} variant="outlined" sx={{ mx: 'auto', p: isReceipt && thermalLayout.paperWidth <= 58 ? 0.75 : isReceipt ? 1 : 2, borderRadius: 1.5, bgcolor: '#fff' }}>
            <Stack spacing={isReceipt ? thermalLayout.contentSpacing : 0.6}>
                <Stack direction="row" spacing={isReceipt ? thermalLayout.headerSpacing : 1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={isReceipt ? thermalLayout.headerInnerSpacing : 1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        {showLogo && logoUrl ? (
                            <Box component="img" src={logoUrl} alt="Logo" sx={{ width: isReceipt ? 30 : 40, height: isReceipt ? 30 : 40, objectFit: 'contain', borderRadius: 1 }} />
                        ) : null}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant={isReceipt ? 'body1' : 'h6'} sx={{ fontWeight: 900, fontSize: isReceipt ? thermalLayout.titleFontSize : '21px', lineHeight: 1.1 }}>
                                {headerTitle}
                            </Typography>
                            {headerSubtitle ? (
                                <Typography variant={isReceipt ? 'caption' : 'body2'} color="text.secondary" sx={{ fontWeight: 700, fontSize: metaFontSize }}>
                                    {headerSubtitle}
                                </Typography>
                            ) : null}
                        </Box>
                    </Stack>
                    <Stack spacing={0} sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, fontSize: metaFontSize }}>
                            {voucher?.voucher_no || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: metaFontSize }}>
                            {formatPrintDate(voucher?.voucher_date) || '—'}
                        </Typography>
                    </Stack>
                </Stack>

                {showContact && (contactPhone || contactEmail || contactAddress) ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: metaFontSize, whiteSpace: 'pre-wrap' }}>
                        {[contactPhone ? `Phone: ${contactPhone}` : null, contactEmail ? `Email: ${contactEmail}` : null, contactAddress || null]
                            .filter(Boolean)
                            .join(' • ')}
                    </Typography>
                ) : null}

                <Divider />

                <Box className="kv">
                    <div className="k">From warehouse</div>
                    <div className="v">{fromWarehouseName}</div>

                    <div className="k">Destination warehouse</div>
                    <div className="v">{toWarehouseName}</div>

                    <div className="k">Recipient</div>
                    <div className="v">{voucher?.default_recipient_name || '—'}</div>

                    <div className="k">Recipient phone</div>
                    <div className="v">{voucher?.default_recipient_phone || '—'}</div>

                    <div className="k">Destination address</div>
                    <div className="v">{toAddress || '—'}</div>

                    <div className="k">Remark</div>
                    <div className="v">{voucher?.default_destination_remark || voucher?.remark || '—'}</div>

                    {showPaymentStatus ? (
                        <>
                            <div className="k">Payment status</div>
                            <div className="v">{voucher?.payment_status || '—'}</div>
                        </>
                    ) : null}
                </Box>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: isReceipt ? thermalLayout.sectionTitleFontSize : '15px' }}>
                    Items
                </Typography>

                <Table
                    size="small"
                    sx={{
                        '& th, & td': {
                            borderColor: 'rgba(0,0,0,0.15)',
                            py: isReceipt ? thermalLayout.tableCellPaddingY : 0.15,
                            px: isReceipt ? thermalLayout.tableCellPaddingX : 0.5,
                            fontSize: isReceipt ? thermalLayout.tableFontSize : '13.5px',
                            verticalAlign: 'top',
                        },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 900, width: '8%' }}>No</TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>Item</TableCell>
                            <TableCell sx={{ fontWeight: 900, width: '16%', textAlign: 'right' }} align="right">
                                Freight
                            </TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>Remark</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(voucher?.items || []).map((it, idx) => (
                            <TableRow key={it.id || idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                                    {`${it?.product?.name || it?.product_name || '—'} . ${formatQty(it?.qty)} . ${it?.unit || it?.product?.unit || '—'}`}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                    {formatMoneyAmount(it?.freight_amount)}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {it?.description || '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!voucher?.items || voucher.items.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={4}>
                                    <Typography variant="body2" color="text.secondary">
                                        No items.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
                    <Box sx={{ minWidth: isReceipt ? 1 : 260, width: isReceipt ? '100%' : 'auto' }}>
                        <Box className="kv">
                            <div className="k">Total qty</div>
                            <div className="v" style={{ textAlign: 'right' }}>{formatQty(totalQty)}</div>
                            <div className="k">Client payable</div>
                            <div className="v" style={{ textAlign: 'right', fontWeight: 900 }}>
                                {formatMoneyAmount(freightTotal)}
                            </div>
                            <div className="k">Paid</div>
                            <div className="v" style={{ textAlign: 'right' }}>
                                {formatMoneyAmount(paymentsTotal)}
                            </div>
                        </Box>
                    </Box>
                </Stack>

                {qrDataUrl || footerNote || printableVoucherPolicy ? <Divider /> : null}

                {qrDataUrl ? (
                    <Stack spacing={0.5} sx={{ alignItems: 'center', pt: 0.75 }}>
                        <Box component="img" src={qrDataUrl} alt="QR" sx={{ width: isReceipt ? thermalLayout.qrImageSize : 140, height: isReceipt ? thermalLayout.qrImageSize : 140 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: metaFontSize, textAlign: 'center' }}>
                            Scan to view voucher status
                        </Typography>
                    </Stack>
                ) : null}

                {footerNote ? (
                    <Typography variant="caption" color="text.secondary" sx={{ pt: 1, fontSize: metaFontSize, textAlign: 'center' }}>
                        {footerNote}
                    </Typography>
                ) : null}

                {printableVoucherPolicy ? (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            pt: 0.5,
                            textAlign: 'center',
                            fontSize: isReceipt ? thermalLayout.policyFontSize : '10px',
                            lineHeight: 1.25,
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {printableVoucherPolicy}
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}
