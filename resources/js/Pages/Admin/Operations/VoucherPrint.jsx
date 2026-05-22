import { Head, usePage } from '@inertiajs/react';
import { Box, Button, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

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
    const { voucher, template = {}, tracking_url: trackingUrl } = usePage().props;
    const initialPaper = String(template?.paper_size || 'A4').toUpperCase() === 'RECEIPT_80' ? 'RECEIPT_80' : 'A4';
    const [paperSize, setPaperSize] = useState(initialPaper);
    const [qrDataUrl, setQrDataUrl] = useState(null);

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
    const showPaymentStatus = Boolean(template?.show_payment_status);
    const isReceipt = paperSize === 'RECEIPT_80';

    useEffect(() => {
        let cancelled = false;

        const raw = typeof trackingUrl === 'string' ? trackingUrl.trim() : '';
        if (!raw) {
            setQrDataUrl(null);
            return () => {
                cancelled = true;
            };
        }

        QRCode.toDataURL(raw, { margin: 1, width: isReceipt ? 220 : 260 })
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
    }, [trackingUrl, isReceipt]);

    useEffect(() => {
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('paper', paperSize);
            window.history.replaceState(null, '', `${u.pathname}?${u.searchParams.toString()}${u.hash}`);
        } catch {
            return;
        }
    }, [paperSize]);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 2 }}>
            <Head title={`Print ${voucher?.voucher_no || 'Voucher'}`} />
            <style>{`
                @page { size: ${isReceipt ? '80mm auto' : 'A4'}; margin: ${isReceipt ? '4mm' : '12mm'}; }
                @media print {
                    body { background: #fff !important; }
                    .no-print { display: none !important; }
                    .print-sheet { box-shadow: none !important; border: none !important; }
                }
                .print-sheet { width: ${isReceipt ? '80mm' : '210mm'}; max-width: 100%; }
                .kv { display: grid; grid-template-columns: ${isReceipt ? '110px 1fr' : '140px 1fr'}; gap: 6px 12px; }
                .kv .k { color: rgba(0,0,0,0.60); font-size: ${isReceipt ? '11px' : '12px'}; }
                .kv .v { font-size: ${isReceipt ? '11px' : '12px'}; font-weight: 600; }
            `}</style>

            <Stack className="no-print" direction="row" spacing={1} sx={{ px: 2, pb: 2, justifyContent: 'center' }}>
                <Button variant={paperSize === 'A4' ? 'contained' : 'outlined'} onClick={() => setPaperSize('A4')}>
                    A4
                </Button>
                <Button variant={paperSize === 'RECEIPT_80' ? 'contained' : 'outlined'} onClick={() => setPaperSize('RECEIPT_80')}>
                    Receipt 80mm
                </Button>
                <Button variant="contained" onClick={() => window.print()}>
                    Print
                </Button>
                <Button variant="outlined" onClick={() => window.close()}>
                    Close
                </Button>
            </Stack>

            <Paper className="print-sheet" variant="outlined" sx={{ mx: 'auto', p: isReceipt ? 1.25 : 2.5, borderRadius: 1.5, bgcolor: '#fff' }}>
                <Stack spacing={isReceipt ? 1 : 1.5}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                            {showLogo && logoUrl ? (
                                <Box
                                    component="img"
                                    src={logoUrl}
                                    alt="Logo"
                                    sx={{ width: isReceipt ? 34 : 44, height: isReceipt ? 34 : 44, objectFit: 'contain', borderRadius: 1 }}
                                />
                            ) : null}
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant={isReceipt ? 'body1' : 'h6'} sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                                    {headerTitle}
                                </Typography>
                                {headerSubtitle ? (
                                    <Typography variant={isReceipt ? 'caption' : 'body2'} color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {headerSubtitle}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Stack>
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {voucher?.voucher_no || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {typeof voucher?.voucher_date === 'string' ? voucher.voucher_date.slice(0, 10) : voucher?.voucher_date || '—'}
                            </Typography>
                        </Box>
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

                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                        Items
                    </Typography>

                    {isReceipt ? (
                        <Stack spacing={0.75}>
                            {(voucher?.items || []).map((it, idx) => (
                                <Box key={it.id || idx} sx={{ borderTop: idx === 0 ? 'none' : '1px dashed rgba(0,0,0,0.25)', pt: idx === 0 ? 0 : 0.75 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                        {idx + 1}. {it?.product?.name || it?.product_name || '—'}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Qty: {formatQty(it?.qty)} {it?.unit || it?.product?.unit || ''}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {it?.is_fragile ? 'Fragile' : ''}
                                        </Typography>
                                    </Stack>
                                    {it?.description ? (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                                            {it.description}
                                        </Typography>
                                    ) : null}
                                </Box>
                            ))}
                            {(!voucher?.items || voucher.items.length === 0) && (
                                <Typography variant="body2" color="text.secondary">
                                    No items.
                                </Typography>
                            )}
                        </Stack>
                    ) : (
                        <Table size="small" sx={{ '& th, & td': { borderColor: 'rgba(0,0,0,0.15)' } }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={52} sx={{ fontWeight: 900 }}>
                                        No
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 900 }}>Item</TableCell>
                                    <TableCell width={96} sx={{ fontWeight: 900 }} align="right">
                                        Qty
                                    </TableCell>
                                    <TableCell width={72} sx={{ fontWeight: 900 }}>
                                        Unit
                                    </TableCell>
                                    <TableCell width={140} sx={{ fontWeight: 900 }}>
                                        From
                                    </TableCell>
                                    <TableCell width={64} sx={{ fontWeight: 900 }}>
                                        Fragile
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(voucher?.items || []).map((it, idx) => (
                                    <TableRow key={it.id || idx}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            {it?.product?.name || it?.product_name || '—'}
                                            {it?.description ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                                                    {it.description}
                                                </Typography>
                                            ) : null}
                                        </TableCell>
                                        <TableCell align="right">{formatQty(it?.qty)}</TableCell>
                                        <TableCell>{it?.unit || it?.product?.unit || '—'}</TableCell>
                                        <TableCell>{it?.from_warehouse?.city || it?.fromWarehouse?.city || '—'}</TableCell>
                                        <TableCell>{it?.is_fragile ? 'Yes' : 'No'}</TableCell>
                                    </TableRow>
                                ))}
                                {(!voucher?.items || voucher.items.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                No items.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}

                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                        <Box sx={{ minWidth: isReceipt ? 1 : 260, width: isReceipt ? '100%' : 'auto' }}>
                            <Box className="kv">
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

                    {qrDataUrl || footerNote ? <Divider /> : null}

                    {qrDataUrl ? (
                        <Stack spacing={0.75} sx={{ alignItems: 'center', pt: 1 }}>
                            <Box
                                component="img"
                                src={qrDataUrl}
                                alt="QR"
                                sx={{ width: isReceipt ? 120 : 140, height: isReceipt ? 120 : 140 }}
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
                </Stack>
            </Paper>
        </Box>
    );
}
