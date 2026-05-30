import { Head, usePage } from '@inertiajs/react';
import {
    Box,
    Button,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    MenuItem,
    NativeSelect,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { getInitialPrintPaper, getPrintLayout, PRINT_PAPER_PRESETS } from '@/utils/printing/printPaperPresets';

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

export default function VoucherPrint() {
    const { voucher, template = {}, voucher_policy: voucherPolicy = '', tracking_url: trackingUrl } = usePage().props;
    const [paperSize, setPaperSize] = useState(() => getInitialPrintPaper(template?.paper_size || 'A4'));
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const [includeQr, setIncludeQr] = useState(true);
    const [includeVoucherPolicy, setIncludeVoucherPolicy] = useState(true);

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
    const layout = useMemo(() => getPrintLayout(paperSize), [paperSize]);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const visibleQrDataUrl = includeQr ? qrDataUrl : null;
    const visibleVoucherPolicy = includeVoucherPolicy ? printableVoucherPolicy : '';

    useEffect(() => {
        let cancelled = false;

        const raw = typeof trackingUrl === 'string' ? trackingUrl.trim() : '';
        if (!raw) {
            setQrDataUrl(null);
            return () => {
                cancelled = true;
            };
        }

        QRCode.toDataURL(raw, { margin: 1, width: layout.qrPreviewWidth })
            .then((url) => {
                if (cancelled) return;
                setQrDataUrl(url);
            })
            .catch(() => {
                if (cancelled) return;
                setQrDataUrl(null);
            });

        return () => {
            cancelled = true;
        };
    }, [trackingUrl, layout.qrPreviewWidth]);

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
            <Head title={`Print ${voucher?.voucher_no || 'Voucher'}`} />
            <style>{`
                @page { size: ${layout.pageSize}; margin: ${layout.pageMargin}; }
                @media print {
                    body { background: #fff !important; }
                    .no-print { display: none !important; }
                    .print-sheet { box-shadow: none !important; border: none !important; }
                }
                .print-sheet { width: ${layout.sheetWidth}; max-width: 100%; }
                .kv { display: grid; grid-template-columns: ${layout.keyColumnWidth} 1fr; gap: 0 10px; }
                .kv .k { color: rgba(0,0,0,0.60); font-size: ${layout.keyFontSize}; }
                .kv .v { font-size: ${layout.valueFontSize}; font-weight: 600; }
            `}</style>

            <Paper className="no-print" variant="outlined" sx={{ mx: 2, mb: 2, borderRadius: 2, p: 2 }}>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Print Preview
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Use your browser print dialog to print this voucher in standard sheet or roll paper sizes.
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', md: 'center' }, flexWrap: 'wrap' }}>
                        <FormControl size="small" fullWidth={isSmallScreen} sx={{ minWidth: { md: 180 } }}>
                            {isSmallScreen ? (
                                <NativeSelect value={paperSize} onChange={(event) => setPaperSize(event.target.value)} inputProps={{ 'aria-label': 'Browser preview paper size' }}>
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
                            control={<Checkbox checked={includeQr} onChange={(event) => setIncludeQr(event.target.checked)} disabled={!qrDataUrl} />}
                            label="Include QR"
                            sx={{ mr: 0 }}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={includeVoucherPolicy}
                                    onChange={(event) => setIncludeVoucherPolicy(event.target.checked)}
                                    disabled={!printableVoucherPolicy}
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
                </Stack>
            </Paper>

            <Paper className="print-sheet" variant="outlined" sx={{ mx: 'auto', p: layout.contentPadding, borderRadius: 2, bgcolor: '#fff' }}>
                <Stack spacing={layout.isRoll ? 0.75 : 1}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                            {showLogo && logoUrl ? (
                                <Box
                                    component="img"
                                    src={logoUrl}
                                    alt="Logo"
                                    sx={{ width: layout.isRoll ? 34 : 44, height: layout.isRoll ? 34 : 44, objectFit: 'contain', borderRadius: 1 }}
                                />
                            ) : null}
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant={layout.isRoll ? 'body1' : 'h6'} sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                                    {headerTitle}
                                </Typography>
                                {headerSubtitle ? (
                                    <Typography variant={layout.isRoll ? 'caption' : 'body2'} color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {headerSubtitle}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Stack>
                        <Stack spacing={0} sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, fontSize: 8 }}>
                                {voucher?.voucher_no || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {typeof voucher?.voucher_date === 'string' ? voucher.voucher_date.slice(0, 10) : voucher?.voucher_date || '—'}
                            </Typography>
                        </Stack>
                    </Stack>

                    {showContact && (contactPhone || contactEmail || contactAddress) ? (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
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
                                <div className="v">{voucher?.payment_status || '—'}</div>
                            </>
                        ) : null}
                    </Box>

                    <Divider />

                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                        Items
                    </Typography>

                    <Table
                        size="small"
                        sx={{
                            '& th, & td': {
                                borderColor: 'rgba(0,0,0,0.15)',
                                py: 0.25,
                                px: 0.75,
                                fontSize: layout.isRoll ? layout.valueFontSize : '13px',
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
                        <Stack spacing={0.75} sx={{ alignItems: 'center', pt: 1 }}>
                            <Box
                                component="img"
                                src={visibleQrDataUrl}
                                alt="QR"
                                sx={{ width: layout.qrImageSize, height: layout.qrImageSize }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Scan to view voucher status
                            </Typography>
                        </Stack>
                    ) : null}

                    {footerNote ? (
                        <Typography variant="caption" color="text.secondary" sx={{ pt: 1.5, textAlign: 'center' }}>
                            {footerNote}
                        </Typography>
                    ) : null}

                    {visibleVoucherPolicy ? (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                pt: footerNote ? 0.75 : 1.5,
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

        </Box>
    );
}
