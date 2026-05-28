import { Head, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    MenuItem,
    NativeSelect,
    Paper,
    Select,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import BluetoothConnectedIcon from '@mui/icons-material/BluetoothConnected';
import BluetoothDisabledIcon from '@mui/icons-material/BluetoothDisabled';
import BluetoothSearchingIcon from '@mui/icons-material/BluetoothSearching';
import PrintIcon from '@mui/icons-material/Print';
import SyncIcon from '@mui/icons-material/Sync';
import QRCode from 'qrcode';
import { buildVoucherEscPosReceipt } from '@/utils/printing/buildVoucherEscPosReceipt';
import { getBluetoothSupportState, mapBluetoothError, WebBluetoothEscPosPrinter } from '@/utils/printing/webBluetoothEscPosPrinter';

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

const THERMAL_PAPER_STORAGE_KEY = 'warehouse.bluetoothPrinterPaperWidth.v1';

function loadThermalPaperWidth() {
    try {
        const saved = window.localStorage.getItem(THERMAL_PAPER_STORAGE_KEY);
        return saved === '58' ? 58 : 80;
    } catch {
        return 80;
    }
}

function saveThermalPaperWidth(width) {
    try {
        window.localStorage.setItem(THERMAL_PAPER_STORAGE_KEY, String(width));
    } catch {
        return;
    }
}

function printerStatusMeta(status) {
    switch (status) {
        case 'connected':
            return { color: 'success', icon: <BluetoothConnectedIcon />, label: 'Connected' };
        case 'connecting':
            return { color: 'info', icon: <BluetoothSearchingIcon />, label: 'Connecting' };
        case 'reconnecting':
            return { color: 'info', icon: <SyncIcon />, label: 'Reconnecting' };
        case 'printing':
            return { color: 'warning', icon: <PrintIcon />, label: 'Printing' };
        case 'unsupported':
            return { color: 'default', icon: <BluetoothDisabledIcon />, label: 'Unsupported' };
        case 'error':
            return { color: 'error', icon: <BluetoothDisabledIcon />, label: 'Error' };
        default:
            return { color: 'default', icon: <BluetoothDisabledIcon />, label: 'Disconnected' };
    }
}

export default function VoucherPrint() {
    const { voucher, template = {}, tracking_url: trackingUrl } = usePage().props;
    const initialPaper = String(template?.paper_size || 'A4').toUpperCase() === 'RECEIPT_80' ? 'RECEIPT_80' : 'A4';
    const [paperSize, setPaperSize] = useState(initialPaper);
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const printerRef = useRef(null);
    const [thermalPaperWidth, setThermalPaperWidth] = useState(loadThermalPaperWidth);
    const [printerStatus, setPrinterStatus] = useState(getBluetoothSupportState().supported ? 'disconnected' : 'unsupported');
    const [printerName, setPrinterName] = useState('');
    const [printerError, setPrinterError] = useState('');
    const [printerBusy, setPrinterBusy] = useState(false);
    const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });

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
    const bluetoothSupport = useMemo(() => getBluetoothSupportState(), []);
    const currentPrinterStatus = printerStatusMeta(printerStatus);
    const isSmallScreen = useMediaQuery('(max-width:600px)');

    useEffect(() => {
        saveThermalPaperWidth(thermalPaperWidth);
    }, [thermalPaperWidth]);

    useEffect(() => {
        const printer = new WebBluetoothEscPosPrinter();
        printerRef.current = printer;

        if (!printer.support.supported) {
            setPrinterStatus('unsupported');
            setPrinterError(printer.support.reason || '');
            return () => {
                printer.disconnect({ silent: true }).catch(() => {});
            };
        }

        let cancelled = false;

        const syncInfo = () => {
            const info = printer.connectionInfo;
            setPrinterName(info.deviceName || '');
            setPrinterStatus(info.connected ? 'connected' : 'disconnected');
        };

        syncInfo();

        const reconnectPreferred = async () => {
            if (!printer.savedPreference?.deviceId) {
                return;
            }

            setPrinterStatus('reconnecting');
            try {
                await printer.reconnectSavedPrinter();
                if (cancelled) return;
                setPrinterError('');
                setToast({
                    open: true,
                    severity: 'success',
                    message: `Reconnected ${printer.connectionInfo.deviceName || 'printer'}.`,
                });
            } catch (error) {
                if (cancelled) return;
                const message = mapBluetoothError(error);
                setPrinterError(message);
                setPrinterStatus('disconnected');
            } finally {
                if (!cancelled) {
                    syncInfo();
                }
            }
        };

        reconnectPreferred();

        return () => {
            cancelled = true;
            printer.disconnect({ silent: true }).catch(() => {});
        };
    }, []);

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

    const updatePrinterInfo = () => {
        const info = printerRef.current?.connectionInfo;
        setPrinterName(info?.deviceName || '');
        setPrinterStatus(info?.connected ? 'connected' : 'disconnected');
    };

    const showToast = (severity, message) => {
        setToast({ open: true, severity, message });
    };

    const handleConnectPrinter = async () => {
        const printer = printerRef.current;
        if (!printer) return;

        setPrinterBusy(true);
        setPrinterStatus('connecting');
        setPrinterError('');

        try {
            await printer.requestAndConnect();
            updatePrinterInfo();
            showToast('success', `Connected ${printer.connectionInfo.deviceName || 'printer'}.`);
        } catch (error) {
            const message = mapBluetoothError(error);
            setPrinterError(message);
            setPrinterStatus(printer.connectionInfo.connected ? 'connected' : 'error');
            showToast('error', message);
        } finally {
            setPrinterBusy(false);
            updatePrinterInfo();
        }
    };

    const handleReconnectPrinter = async () => {
        const printer = printerRef.current;
        if (!printer) return;

        setPrinterBusy(true);
        setPrinterStatus('reconnecting');
        setPrinterError('');

        try {
            const info = await printer.reconnectSavedPrinter();
            if (!info) {
                throw new Error('No saved printer found. Use Connect Printer first.');
            }

            updatePrinterInfo();
            showToast('success', `Reconnected ${printer.connectionInfo.deviceName || 'printer'}.`);
        } catch (error) {
            const message = mapBluetoothError(error);
            setPrinterError(message);
            setPrinterStatus('error');
            showToast('error', message);
        } finally {
            setPrinterBusy(false);
            updatePrinterInfo();
        }
    };

    const handleDisconnectPrinter = async () => {
        const printer = printerRef.current;
        if (!printer) return;

        setPrinterBusy(true);
        try {
            await printer.disconnect();
            setPrinterError('');
            setPrinterStatus('disconnected');
            setPrinterName('');
            showToast('success', 'Printer disconnected.');
        } catch (error) {
            const message = mapBluetoothError(error);
            setPrinterError(message);
            setPrinterStatus('error');
            showToast('error', message);
        } finally {
            setPrinterBusy(false);
            updatePrinterInfo();
        }
    };

    const handleBluetoothPrint = async () => {
        const printer = printerRef.current;
        if (!printer) return;

        setPrinterBusy(true);
        setPrinterStatus('printing');
        setPrinterError('');

        try {
            if (!printer.connectionInfo.connected) {
                await printer.requestAndConnect();
            }

            const bytes = buildVoucherEscPosReceipt({
                voucher,
                template,
                trackingUrl,
                paperWidth: thermalPaperWidth,
            });

            await printer.print(bytes);
            updatePrinterInfo();
            showToast('success', `Receipt sent to ${printer.connectionInfo.deviceName || 'printer'}.`);
        } catch (error) {
            const message = mapBluetoothError(error);
            setPrinterError(message);
            setPrinterStatus('error');
            showToast('error', message);
        } finally {
            setPrinterBusy(false);
            updatePrinterInfo();
        }
    };

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

            <Paper className="no-print" variant="outlined" sx={{ mx: 2, mb: 2, borderRadius: 2, p: 2 }}>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Bluetooth Thermal Printing
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Direct BLE ESC/POS receipt printing for Android Chrome. No RawBT, no Android print dialog.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip
                                color={currentPrinterStatus.color}
                                icon={currentPrinterStatus.icon}
                                label={printerName ? `${currentPrinterStatus.label}: ${printerName}` : currentPrinterStatus.label}
                                variant={printerStatus === 'connected' ? 'filled' : 'outlined'}
                            />
                            {printerBusy ? <CircularProgress size={22} /> : null}
                        </Stack>
                    </Stack>

                    {!bluetoothSupport.supported ? (
                        <Alert severity="warning">{bluetoothSupport.reason}</Alert>
                    ) : (
                        <Alert severity="info">
                            Works with BLE ESC/POS printers exposed through Web Bluetooth. Classic Bluetooth SPP-only printers will not print directly from the browser.
                        </Alert>
                    )}

                    {printerError ? <Alert severity="error">{printerError}</Alert> : null}

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', md: 'center' }, flexWrap: 'wrap' }}>
                        <FormControl size="small" fullWidth={isSmallScreen} sx={{ minWidth: { md: 180 } }}>
                            {isSmallScreen ? (
                                <NativeSelect value={paperSize} onChange={(event) => setPaperSize(event.target.value)} inputProps={{ 'aria-label': 'Browser preview paper size' }}>
                                    <option value="A4">Browser preview: A4</option>
                                    <option value="RECEIPT_80">Browser preview: Receipt 80mm</option>
                                </NativeSelect>
                            ) : (
                                <Select value={paperSize} onChange={(event) => setPaperSize(event.target.value)}>
                                    <MenuItem value="A4">Browser preview: A4</MenuItem>
                                    <MenuItem value="RECEIPT_80">Browser preview: Receipt 80mm</MenuItem>
                                </Select>
                            )}
                        </FormControl>
                        <FormControl size="small" fullWidth={isSmallScreen} sx={{ minWidth: { md: 180 } }}>
                            {isSmallScreen ? (
                                <NativeSelect
                                    value={thermalPaperWidth}
                                    onChange={(event) => setThermalPaperWidth(Number(event.target.value))}
                                    inputProps={{ 'aria-label': 'Thermal paper width' }}
                                >
                                    <option value={58}>Thermal paper: 58mm</option>
                                    <option value={80}>Thermal paper: 80mm</option>
                                </NativeSelect>
                            ) : (
                                <Select value={thermalPaperWidth} onChange={(event) => setThermalPaperWidth(Number(event.target.value))}>
                                    <MenuItem value={58}>Thermal paper: 58mm</MenuItem>
                                    <MenuItem value={80}>Thermal paper: 80mm</MenuItem>
                                </Select>
                            )}
                        </FormControl>
                        <Button variant="contained" onClick={() => window.print()}>
                            Browser Print
                        </Button>
                        <Button variant="contained" color="success" startIcon={<PrintIcon />} onClick={handleBluetoothPrint} disabled={printerBusy || !bluetoothSupport.supported}>
                            Print via Bluetooth
                        </Button>
                        <Button variant="outlined" startIcon={<BluetoothSearchingIcon />} onClick={handleConnectPrinter} disabled={printerBusy || !bluetoothSupport.supported}>
                            Connect Printer
                        </Button>
                        <Button variant="outlined" startIcon={<SyncIcon />} onClick={handleReconnectPrinter} disabled={printerBusy || !bluetoothSupport.supported}>
                            Reconnect
                        </Button>
                        <Button variant="outlined" color="inherit" startIcon={<BluetoothDisabledIcon />} onClick={handleDisconnectPrinter} disabled={printerBusy || !bluetoothSupport.supported}>
                            Disconnect
                        </Button>
                        <Button variant="outlined" onClick={() => window.close()}>
                            Close
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

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

            <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast((current) => ({ ...current, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={toast.severity} variant="filled" onClose={() => setToast((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
