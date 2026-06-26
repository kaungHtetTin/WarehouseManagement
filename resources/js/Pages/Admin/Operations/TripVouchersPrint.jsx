import { Head, usePage } from '@inertiajs/react';
import { Box, Button, Checkbox, Divider, FormControl, FormControlLabel, MenuItem, NativeSelect, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useT } from '@/i18n';
import { formatPrintDate, formatPrintDateTime } from '@/utils/printing/dateFormat';
import { getInitialPrintPaper, getPrintLayout, PRINT_PAPER_PRESETS } from '@/utils/printing/printPaperPresets';
import { tripStatusLabel, voucherPaymentStatusLabel } from '@/utils/statusLabels';

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

function TripPaidSummaryStrip({ trip, summary, layout }) {
    if (!summary) {
        return null;
    }

    return (
        <Paper className="print-sheet trip-summary-sheet" variant="outlined" sx={{ mx: 'auto', mb: layout.contentSpacing, p: layout.contentPadding, borderRadius: 2, bgcolor: '#fff' }}>
            <Stack spacing={layout.contentSpacing}>
                <Stack direction="row" spacing={layout.headerSpacing} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant={layout.isRoll ? 'body2' : 'subtitle1'} sx={{ fontWeight: 900, fontSize: layout.sectionTitleFontSize, lineHeight: 1.1 }}>
                            Trip print summary
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: layout.metaFontSize }}>
                            {summary.trip_no || trip?.trip_no || '—'}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: layout.metaFontSize }}>
                            Total already paid
                        </Typography>
                        <Typography variant={layout.isRoll ? 'body1' : 'h6'} sx={{ fontWeight: 900, fontSize: layout.titleFontSize, lineHeight: 1.1 }}>
                            {formatMoneyAmount(summary.paid_amount)}
                        </Typography>
                    </Box>
                </Stack>

                <Box className="kv">
                    <div className="k">Loaded vouchers</div>
                    <div className="v">{summary.voucher_count ?? 0}</div>

                    <div className="k">Trip freight</div>
                    <div className="v">{formatMoneyAmount(summary.total_amount)}</div>

                    <div className="k">Total labor cost</div>
                    <div className="v">{formatMoneyAmount(summary.labor_cost)}</div>

                    <div className="k">Loaded qty</div>
                    <div className="v">{formatQty(summary.total_loaded_qty)}</div>

                    {summary.remark ? (
                        <>
                            <div className="k">Remark</div>
                            <div className="v" style={{ whiteSpace: 'pre-wrap' }}>{summary.remark}</div>
                        </>
                    ) : null}
                </Box>
            </Stack>
        </Paper>
    );
}

function TripOverviewSheet({ trip, overviewSlip, layout, t }) {
    if (!overviewSlip) {
        return null;
    }

    return (
        <Paper className="print-sheet voucher-sheet" variant="outlined" sx={{ mx: 'auto', p: layout.contentPadding, borderRadius: 2, bgcolor: '#fff' }}>
            <Stack spacing={layout.contentSpacing}>
                <Stack direction="row" spacing={layout.headerSpacing} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant={layout.isRoll ? 'body1' : 'h6'} sx={{ fontWeight: 900, fontSize: layout.titleFontSize, lineHeight: 1.1 }}>
                            {overviewSlip.title || 'Trip Overview Slip'}
                        </Typography>
                        <Typography variant={layout.isRoll ? 'caption' : 'body2'} color="text.secondary" sx={{ fontWeight: 700, fontSize: layout.metaFontSize }}>
                            Loaded vouchers summary for trip {overviewSlip.trip_no || trip?.trip_no || '—'}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, fontSize: layout.metaFontSize }}>
                            {overviewSlip.trip_no || trip?.trip_no || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: layout.metaFontSize }}>
                            {formatPrintDateTime(overviewSlip.generated_at) || '—'}
                        </Typography>
                    </Box>
                </Stack>

                <Divider />

                <Box className="kv">
                    <div className="k">Trip status</div>
                    <div className="v">{tripStatusLabel(overviewSlip.status || trip?.status, t)}</div>

                    <div className="k">Vehicle</div>
                    <div className="v">{overviewSlip.vehicle_label || '—'}</div>

                    <div className="k">Driver</div>
                    <div className="v">{overviewSlip.driver_label || '—'}</div>

                    <div className="k">Destination</div>
                    <div className="v">{overviewSlip.destination_label || '—'}</div>

                    <div className="k">Loaded vouchers</div>
                    <div className="v">{overviewSlip.voucher_count ?? 0}</div>

                    <div className="k">Loaded qty</div>
                    <div className="v">{formatQty(overviewSlip.total_loaded_qty)}</div>

                    <div className="k">Trip freight</div>
                    <div className="v">{formatMoneyAmount(overviewSlip.total_amount)}</div>

                    <div className="k">Total labor cost</div>
                    <div className="v">{formatMoneyAmount(overviewSlip.labor_cost)}</div>

                    <div className="k">Total already paid</div>
                    <div className="v">{formatMoneyAmount(overviewSlip.paid_amount)}</div>

                    {overviewSlip.remark ? (
                        <>
                            <div className="k">Remark</div>
                            <div className="v" style={{ whiteSpace: 'pre-wrap' }}>{overviewSlip.remark}</div>
                        </>
                    ) : null}
                </Box>

                {overviewSlip.manifest_printed_at ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: layout.metaFontSize }}>
                        Manifest printed: {formatPrintDateTime(overviewSlip.manifest_printed_at)}
                    </Typography>
                ) : null}

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: layout.sectionTitleFontSize }}>
                    Loaded vouchers
                </Typography>

                <Table
                    size="small"
                    sx={{
                        tableLayout: 'fixed',
                        '& th, & td': {
                            borderColor: 'rgba(0,0,0,0.15)',
                            ...(layout.isRoll ? { px: layout.tableCellPaddingX, py: layout.tableCellPaddingY, fontSize: layout.tableFontSize, verticalAlign: 'top' } : {}),
                        },
                    }}
                >
                    {layout.isRoll ? (
                        <>
                            <TableHead>
                                <TableRow>
                                    <TableCell width="12%" sx={{ fontWeight: 900 }}>
                                        No
                                    </TableCell>
                                    <TableCell width="58%" sx={{ fontWeight: 900 }}>
                                        Voucher
                                    </TableCell>
                                    <TableCell width="30%" sx={{ fontWeight: 900 }} align="right">
                                        Qty
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(overviewSlip.rows || []).map((row, idx) => (
                                    <TableRow key={row.voucher_id || idx}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                                            {row.voucher_no || '—'}
                                            {row.recipient_label ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: layout.policyFontSize }}>
                                                    {row.recipient_label}
                                                </Typography>
                                            ) : null}
                                            {row.destination_warehouse_label ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: layout.policyFontSize }}>
                                                    {row.destination_warehouse_label}
                                                </Typography>
                                            ) : null}
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: layout.policyFontSize }}>
                                                Paid: {formatMoneyAmount(row.paid_amount)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatQty(row.total_items_qty)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(overviewSlip.rows || []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                No loaded vouchers.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {(overviewSlip.rows || []).length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} sx={{ fontWeight: 900 }}>
                                            Total labor cost
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                                            {formatMoneyAmount(overviewSlip.labor_cost)}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {(overviewSlip.rows || []).length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} sx={{ fontWeight: 900 }}>
                                            Total already paid
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                                            {formatMoneyAmount(overviewSlip.paid_amount)}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </>
                    ) : (
                        <>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={52} sx={{ fontWeight: 900 }}>
                                        No
                                    </TableCell>
                                    <TableCell width={120} sx={{ fontWeight: 900 }}>
                                        Voucher
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 900 }}>Recipient</TableCell>
                                    <TableCell sx={{ fontWeight: 900 }}>Destination</TableCell>
                                    <TableCell width={90} sx={{ fontWeight: 900 }} align="right">
                                        Qty
                                    </TableCell>
                                    <TableCell width={110} sx={{ fontWeight: 900 }} align="right">
                                        Amount
                                    </TableCell>
                                    <TableCell width={110} sx={{ fontWeight: 900 }} align="right">
                                        Paid
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(overviewSlip.rows || []).map((row, idx) => (
                                    <TableRow key={row.voucher_id || idx}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{row.voucher_no || '—'}</TableCell>
                                        <TableCell>{row.recipient_label || '—'}</TableCell>
                                        <TableCell>{row.destination_warehouse_label || '—'}</TableCell>
                                        <TableCell align="right">{formatQty(row.total_items_qty)}</TableCell>
                                        <TableCell align="right">{formatMoneyAmount(row.total_amount)}</TableCell>
                                        <TableCell align="right">{formatMoneyAmount(row.paid_amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {(overviewSlip.rows || []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <Typography variant="body2" color="text.secondary">
                                                No loaded vouchers.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {(overviewSlip.rows || []).length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="right" sx={{ fontWeight: 900 }}>
                                            Total labor cost
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                                            {formatMoneyAmount(overviewSlip.labor_cost)}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {(overviewSlip.rows || []).length > 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="right" sx={{ fontWeight: 900 }}>
                                            Total already paid
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                                            {formatMoneyAmount(overviewSlip.paid_amount)}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </>
                    )}
                </Table>
            </Stack>
        </Paper>
    );
}

function VoucherSheet({ voucher, template, voucherPolicy, layout, qrDataUrl, includeQr, includeVoucherPolicy, t }) {
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

    const fromWarehouseName = voucher?.source_warehouse?.city || voucher?.sourceWarehouse?.city || '—';
    const toWarehouseName = voucher?.default_to_warehouse?.city || voucher?.defaultToWarehouse?.city || '—';
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
    const visibleQrDataUrl = includeQr ? qrDataUrl : null;
    const visibleVoucherPolicy = includeVoucherPolicy ? printableVoucherPolicy : '';

    return (
        <Paper className="print-sheet voucher-sheet" variant="outlined" sx={{ mx: 'auto', p: layout.contentPadding, borderRadius: 2, bgcolor: '#fff' }}>
            <Stack spacing={layout.contentSpacing}>
                <Stack direction="row" spacing={layout.headerSpacing} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={layout.headerInnerSpacing} sx={{ alignItems: 'center', minWidth: 0 }}>
                        {showLogo && logoUrl ? (
                            <Box
                                component="img"
                                src={logoUrl}
                                alt="Logo"
                                sx={{ width: layout.isRoll ? 34 : 44, height: layout.isRoll ? 34 : 44, objectFit: 'contain', borderRadius: 1 }}
                            />
                        ) : null}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant={layout.isRoll ? 'body1' : 'h6'} sx={{ fontWeight: 900, fontSize: layout.titleFontSize, lineHeight: 1.1 }}>
                                {headerTitle}
                            </Typography>
                            {headerSubtitle ? (
                                <Typography variant={layout.isRoll ? 'caption' : 'body2'} color="text.secondary" sx={{ fontWeight: 700, fontSize: layout.metaFontSize }}>
                                    {headerSubtitle}
                                </Typography>
                            ) : null}
                        </Box>
                    </Stack>
                    <Stack spacing={0} sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" sx={{ fontSize: layout.metaFontSize }}>
                            {voucher?.voucher_no || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: layout.metaFontSize }}>
                            {formatPrintDate(voucher?.voucher_date) || '—'}
                        </Typography>
                    </Stack>
                </Stack>

                {showContact && (contactPhone || contactEmail || contactAddress) ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: layout.metaFontSize, whiteSpace: 'pre-wrap' }}>
                        {[contactPhone ? `Phone: ${contactPhone}` : null, contactEmail ? `Email: ${contactEmail}` : null, contactAddress || null]
                            .filter(Boolean)
                            .join(' • ')}
                    </Typography>
                ) : null}

                <Divider />

                <Box className="kv">
                    <div className="k">From</div>
                    <div className="v">{fromWarehouseName}</div>

                    <div className="k">Designation</div>
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
                            <div className="v">{voucherPaymentStatusLabel(voucher?.payment_status, t)}</div>
                        </>
                    ) : null}
                </Box>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: layout.sectionTitleFontSize }}>
                    Items
                </Typography>

                <Table
                    size="small"
                    sx={{
                        '& th, & td': {
                            borderColor: 'rgba(0,0,0,0.15)',
                            py: layout.tableCellPaddingY,
                            px: layout.tableCellPaddingX,
                            fontSize: layout.tableFontSize,
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

                <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                    <Box sx={{ minWidth: layout.isRoll ? 1 : layout.amountBoxMinWidth, width: layout.isRoll ? '100%' : 'auto' }}>
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

                {visibleQrDataUrl || footerNote || visibleVoucherPolicy ? <Divider /> : null}

                {visibleQrDataUrl ? (
                    <Stack spacing={0.5} sx={{ alignItems: 'center', pt: layout.qrTopPadding }}>
                        <Box
                            component="img"
                            src={visibleQrDataUrl}
                            alt="QR"
                            sx={{ width: layout.qrImageSize, height: layout.qrImageSize }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: layout.metaFontSize, textAlign: 'center' }}>
                            Scan to view voucher status
                        </Typography>
                    </Stack>
                ) : null}

                {footerNote ? (
                    <Typography variant="caption" color="text.secondary" sx={{ pt: layout.footerTopPadding, fontSize: layout.metaFontSize, textAlign: 'center' }}>
                        {footerNote}
                    </Typography>
                ) : null}

                {visibleVoucherPolicy ? (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            pt: layout.policyTopPadding,
                            textAlign: 'justify',
                            whiteSpace: 'pre-wrap',
                            fontSize: layout.policyFontSize,
                            lineHeight: 1.35,
                        }}
                    >
                        {visibleVoucherPolicy}
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}

export default function TripVouchersPrint() {
    const t = useT();
    const {
        trip,
        vouchers = [],
        template = {},
        voucher_policy: voucherPolicy = '',
        tracking_urls: trackingUrls = {},
        trip_print_summary: tripPrintSummary = null,
        overview_slip: overviewSlip = null,
    } = usePage().props;
    const [paperSize, setPaperSize] = useState(() => getInitialPrintPaper(template?.paper_size || 'A4'));
    const [qrDataUrls, setQrDataUrls] = useState({});
    const [includeQr, setIncludeQr] = useState(true);
    const [includeVoucherPolicy, setIncludeVoucherPolicy] = useState(true);
    const layout = useMemo(() => getPrintLayout(paperSize), [paperSize]);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const hasQr = Object.values(qrDataUrls).some(Boolean);
    const hasVoucherPolicy = safeStr(voucherPolicy) !== '';

    useEffect(() => {
        let cancelled = false;

        const buildQrs = async () => {
            const next = {};
            for (const voucher of vouchers) {
                const raw = typeof trackingUrls?.[voucher?.id] === 'string' ? trackingUrls[voucher.id].trim() : '';
                if (!raw) continue;
                try {
                    next[voucher.id] = await QRCode.toDataURL(raw, { margin: 1, width: layout.qrPreviewWidth });
                } catch {
                    next[voucher.id] = null;
                }
            }
            if (!cancelled) {
                setQrDataUrls(next);
            }
        };

        buildQrs();
        return () => {
            cancelled = true;
        };
    }, [trackingUrls, vouchers, layout.qrPreviewWidth]);

    useEffect(() => {
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('paper', paperSize);
            window.history.replaceState(null, '', `${u.pathname}?${u.searchParams.toString()}${u.hash}`);
        } catch {
            // ignore
        }
        try {
            window.localStorage.setItem('warehouse.printPaperSize.v1', paperSize);
        } catch {
            // ignore
        }
    }, [paperSize]);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 1.5 }}>
            <Head title={`${overviewSlip ? 'Print trip slip and vouchers' : 'Print vouchers'} ${trip?.trip_no || ''}`.trim()} />
            <style>{`
                @page { size: ${layout.pageSize}; margin: ${layout.pageMargin}; }
                @media print {
                    body { background: #fff !important; }
                    .no-print { display: none !important; }
                    .print-sheet { box-shadow: none !important; border: none !important; }
                }
                .print-sheet { width: ${layout.sheetWidth}; max-width: 100%; }
                .voucher-sheet { page-break-after: always; break-after: page; margin-bottom: ${layout.pageMargin}; }
                .voucher-sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
                .kv { display: grid; grid-template-columns: ${layout.keyColumnWidth} 1fr; gap: 0 ${layout.kvColumnGap}; }
                .kv .k { color: rgba(0,0,0,0.60); font-size: ${layout.keyFontSize}; }
                .kv .v { font-size: ${layout.valueFontSize}; font-weight: 600; }
            `}</style>

            <Stack className="no-print" direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ px: 2, pb: 2, justifyContent: 'center', alignItems: { xs: 'stretch', md: 'center' }, flexWrap: 'wrap' }}>
                <FormControl size="small" fullWidth={isSmallScreen} sx={{ minWidth: { md: 240 } }}>
                    {isSmallScreen ? (
                        <NativeSelect value={paperSize} onChange={(event) => setPaperSize(event.target.value)} inputProps={{ 'aria-label': 'Trip voucher paper size' }}>
                            {PRINT_PAPER_PRESETS.map((preset) => (
                                <option key={preset.value} value={preset.value}>
                                    {preset.label}
                                </option>
                            ))}
                        </NativeSelect>
                    ) : (
                        <Select value={paperSize} onChange={(event) => setPaperSize(event.target.value)}>
                            {PRINT_PAPER_PRESETS.map((preset) => (
                                <MenuItem key={preset.value} value={preset.value}>
                                    {preset.label}
                                </MenuItem>
                            ))}
                        </Select>
                    )}
                </FormControl>
                <FormControlLabel
                    control={<Checkbox checked={includeQr} onChange={(event) => setIncludeQr(event.target.checked)} disabled={!hasQr} />}
                    label="Include QR"
                    sx={{ mr: 0 }}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={includeVoucherPolicy}
                            onChange={(event) => setIncludeVoucherPolicy(event.target.checked)}
                            disabled={!hasVoucherPolicy}
                        />
                    }
                    label="Include policy"
                    sx={{ mr: 0 }}
                />
                <Button variant="contained" onClick={() => window.print()}>
                    Print
                </Button>
                <Button variant="outlined" onClick={() => window.close()}>
                    Close
                </Button>
            </Stack>

            {overviewSlip ? <TripOverviewSheet trip={trip} overviewSlip={overviewSlip} layout={layout} t={t} /> : null}
            {!overviewSlip ? <TripPaidSummaryStrip trip={trip} summary={tripPrintSummary} layout={layout} /> : null}

            {vouchers.length === 0 ? (
                <Paper className="print-sheet" variant="outlined" sx={{ mx: 'auto', p: 2, borderRadius: 2, bgcolor: '#fff' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                        {trip?.trip_no || 'Trip'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        No vouchers on this trip.
                    </Typography>
                </Paper>
            ) : (
                vouchers.map((voucher) => (
                    <VoucherSheet
                        key={voucher.id}
                        voucher={voucher}
                        template={template}
                        voucherPolicy={voucherPolicy}
                        layout={layout}
                        qrDataUrl={qrDataUrls[voucher.id] ?? null}
                        includeQr={includeQr}
                        includeVoucherPolicy={includeVoucherPolicy}
                        t={t}
                    />
                ))
            )}
        </Box>
    );
}
