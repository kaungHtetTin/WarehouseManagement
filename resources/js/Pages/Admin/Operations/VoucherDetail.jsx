import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

const PAYMENT_LABELS = {
    UNPAID: 'Unpaid',
    PARTIAL: 'Partial',
    PAID: 'Paid',
    WAIVED: 'Waived',
};

function freightTotalFromItems(items) {
    if (!items?.length) {
        return null;
    }
    let sum = 0;
    for (const it of items) {
        const fa = Number(it?.freight_amount);
        if (Number.isFinite(fa)) {
            sum += fa;
        }
    }
    return Math.round(sum * 100) / 100;
}

const PAYMENT_METHOD_LABELS = {
    CASH: 'Cash',
    TRANSFER: 'Transfer',
    OTHER: 'Other',
};

function toDatetimeLocalValue(date) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMoneyAmount(value) {
    if (value == null || value === '') {
        return '—';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function destinationFieldOneLine(value) {
    if (value == null || String(value).trim() === '') return '';
    return String(value)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
}

function formatLineDestination(it) {
    const addr = [
        destinationFieldOneLine(it.to_address_line1),
        destinationFieldOneLine(it.to_address_line2),
        it.to_township,
        it.to_city,
        it.to_region,
        it.to_postal_code,
    ]
        .filter((x) => x != null && String(x).trim() !== '')
        .join(', ');
    const recv = [it.recipient_name, it.recipient_phone].filter((x) => x != null && String(x).trim() !== '').join(' · ');
    if (addr && recv) return `${addr} · ${recv}`;
    if (addr) return addr;
    if (recv) return recv;
    if (it.to_city) return String(it.to_city);
    return '—';
}

function formatDefaultDestinationPreview(v) {
    if (!v) return '—';
    return formatLineDestination({
        to_address_line1: v.default_to_address_line1,
        to_address_line2: v.default_to_address_line2,
        to_township: v.default_to_township,
        to_city: v.default_to_city,
        to_region: v.default_to_region,
        to_postal_code: v.default_to_postal_code,
        recipient_name: v.default_recipient_name,
        recipient_phone: v.default_recipient_phone,
    });
}

function DetailField({ label, value }) {
    return (
        <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                {value != null && value !== '' ? value : '—'}
            </Typography>
        </Box>
    );
}

function statusChipColor(status) {
    if (status === 'DRAFT') return 'default';
    if (status === 'CONFIRMED') return 'success';
    if (status === 'CANCELLED') return 'error';
    if (status === 'DELIVERED' || status === 'CLOSED') return 'success';
    return 'primary';
}

function LineCard({ item, lineNo }) {
    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, maxWidth: '100%', minWidth: 0 }}>
            <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Line {lineNo}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {item.product?.name ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {item.qty} {item.unit}
                    {item.from_warehouse?.code ? ` · From ${item.from_warehouse.code}` : ''}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {formatLineDestination(item)}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {item.is_fragile ? <Chip size="small" label="Fragile" color="warning" variant="outlined" /> : null}
                    <Chip size="small" label={PAYMENT_LABELS[item.payment_status] ?? item.payment_status} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    Freight: {formatMoneyAmount(item.freight_amount)} {item.freight_rate != null ? `(rate ${item.freight_rate})` : ''}
                </Typography>
            </Stack>
        </Paper>
    );
}

export default function VoucherDetail() {
    const pageProps = usePage().props;
    const voucher = pageProps.voucher;
    const adminAppUrl = pageProps.admin_app_url;
    const canRecordVoucherPayments = pageProps.can_record_voucher_payments ?? false;
    const flash = pageProps.flash ?? {};

    const [paymentOpen, setPaymentOpen] = useState(false);

    const paymentForm = useForm({
        amount: '',
        currency: 'MMK',
        payment_method: 'CASH',
        paid_at: '',
        reference_no: '',
        note: '',
        voucher_item_id: '',
    });

    const openPaymentDialog = () => {
        paymentForm.setData({
            amount: '',
            currency: 'MMK',
            payment_method: 'CASH',
            paid_at: toDatetimeLocalValue(new Date()),
            reference_no: '',
            note: '',
            voucher_item_id: '',
        });
        paymentForm.clearErrors();
        setPaymentOpen(true);
    };

    const submitPayment = (e) => {
        e.preventDefault();
        if (!voucher?.id) return;
        paymentForm.post(`${adminAppUrl}/operations/vouchers/${voucher.id}/payments`, {
            preserveScroll: true,
            onSuccess: () => setPaymentOpen(false),
        });
    };

    const paymentsTotal = useMemo(() => {
        let s = 0;
        for (const p of voucher?.payments || []) {
            const n = Number(p?.amount);
            if (Number.isFinite(n)) s += n;
        }
        return Math.round(s * 100) / 100;
    }, [voucher?.payments]);

    const layoutTitle = voucher?.voucher_no ? `Voucher ${voucher.voucher_no}` : 'Voucher';

    const totalAmountDisplay = useMemo(() => {
        if (!voucher) return null;
        const raw = voucher.total_amount;
        if (raw != null && raw !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) return n;
        }
        if (!voucher.items?.length) return null;
        return freightTotalFromItems(voucher.items) ?? 0;
    }, [voucher?.total_amount, voucher?.items]);

    if (!voucher) {
        return (
            <AdminLayout title="Voucher">
                <Head title="Voucher" />
                <Typography variant="body2" color="text.secondary">
                    Not found.
                </Typography>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={layoutTitle}>
            <Head title={layoutTitle} />
            <Stack spacing={2.5}>
                {flash.success ? <Alert severity="success">{flash.success}</Alert> : null}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                    <Button
                        component={Link}
                        href={`${adminAppUrl}/operations/vouchers`}
                        startIcon={<ArrowBackIcon />}
                        variant="text"
                        sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                    >
                        Back to vouchers
                    </Button>
                </Stack>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
                            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em', flex: '1 1 auto', minWidth: 0 }}>
                                {voucher.voucher_no}
                            </Typography>
                            <Chip size="small" label={voucher.status} color={statusChipColor(voucher.status)} variant="outlined" />
                            <Chip
                                size="small"
                                label={PAYMENT_LABELS[voucher.payment_status] ?? voucher.payment_status}
                                variant="outlined"
                            />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            Read-only detail for confirmed and in-process vouchers. Drafts are edited in the wizard.
                        </Typography>
                        <Divider />
                        <Stack direction="row" flexWrap="wrap" sx={{ gap: 2.5 }}>
                            <DetailField
                                label="Date"
                                value={typeof voucher.voucher_date === 'string' ? voucher.voucher_date.slice(0, 10) : voucher.voucher_date}
                            />
                            <DetailField label="Source warehouse" value={voucher.source_warehouse?.name} />
                            <DetailField label="Total qty" value={voucher.total_qty != null ? String(voucher.total_qty) : null} />
                            <DetailField label="Total amount" value={formatMoneyAmount(totalAmountDisplay)} />
                            {voucher.creator?.name ? <DetailField label="Created by" value={voucher.creator.name} /> : null}
                        </Stack>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                        Merchant
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" sx={{ gap: 2.5 }}>
                        <DetailField label="Name" value={voucher.merchant?.name} />
                        <DetailField label="Phone" value={voucher.merchant?.phone} />
                        <DetailField label="NRC / ID" value={voucher.merchant?.nrc_or_id} />
                        <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
                            <DetailField label="Address" value={voucher.merchant?.address} />
                        </Box>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                        Default delivery (summary)
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" sx={{ gap: 2.5 }}>
                        <DetailField
                            label="Default to warehouse"
                            value={
                                voucher.default_to_warehouse ? `${voucher.default_to_warehouse.name} (${voucher.default_to_warehouse.code})` : null
                            }
                        />
                        <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Address snapshot
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {formatDefaultDestinationPreview(voucher)}
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>

                {voucher.remark ? (
                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                            Remark
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {voucher.remark}
                        </Typography>
                    </Paper>
                ) : null}

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Payments
                        </Typography>
                        {canRecordVoucherPayments ? (
                            <Button size="small" variant="outlined" onClick={openPaymentDialog}>
                                Record payment
                            </Button>
                        ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Total recorded: {formatMoneyAmount(paymentsTotal)}{' '}
                        {(voucher.payments && voucher.payments[0]?.currency) || 'MMK'}
                        {totalAmountDisplay != null ? (
                            <>
                                {' '}
                                · Expected total {formatMoneyAmount(totalAmountDisplay)}
                                {!voucher.total_amount && voucher.items?.length ? ' (sum of freight lines)' : ''}
                            </>
                        ) : null}
                    </Typography>
                    {!canRecordVoucherPayments ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            Recording payments requires the payments.manage permission.
                        </Typography>
                    ) : null}
                    {(voucher.payments || []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No payments recorded yet.
                        </Typography>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell>Paid at</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell>Method</TableCell>
                                        <TableCell>Reference</TableCell>
                                        <TableCell>Recorded by</TableCell>
                                        <TableCell>Note</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(voucher.payments || []).map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatMoneyAmount(p.amount)} {p.currency ?? 'MMK'}
                                            </TableCell>
                                            <TableCell>{PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}</TableCell>
                                            <TableCell>{p.reference_no ?? '—'}</TableCell>
                                            <TableCell>{p.receiver?.name ?? '—'}</TableCell>
                                            <TableCell sx={{ maxWidth: 220, wordBreak: 'break-word' }}>{p.note ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>

                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Lines
                    </Typography>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell width={48}>#</TableCell>
                                        <TableCell>Product</TableCell>
                                        <TableCell>Qty</TableCell>
                                        <TableCell>Unit</TableCell>
                                        <TableCell>From</TableCell>
                                        <TableCell sx={{ minWidth: 200 }}>Destination</TableCell>
                                        <TableCell align="right">Freight</TableCell>
                                        <TableCell>Line payment</TableCell>
                                        <TableCell align="center">Fragile</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(voucher.items || []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No lines.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (voucher.items || []).map((it, idx) => (
                                        <TableRow key={it.id}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{it.product?.name ?? '—'}</TableCell>
                                            <TableCell>{it.qty}</TableCell>
                                            <TableCell>{it.unit}</TableCell>
                                            <TableCell>{it.from_warehouse?.code ?? '—'}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {formatLineDestination(it)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">{formatMoneyAmount(it.freight_amount)}</TableCell>
                                            <TableCell>{PAYMENT_LABELS[it.payment_status] ?? it.payment_status}</TableCell>
                                            <TableCell align="center">{it.is_fragile ? 'Yes' : '—'}</TableCell>
                                        </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                    <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' } }}>
                        {(voucher.items || []).length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No lines.
                            </Typography>
                        ) : (
                            (voucher.items || []).map((it, idx) => <LineCard key={it.id} item={it} lineNo={idx + 1} />)
                        )}
                    </Stack>
                </Box>

                <Dialog open={paymentOpen} onClose={() => !paymentForm.processing && setPaymentOpen(false)} fullWidth maxWidth="sm">
                    <Box component="form" onSubmit={submitPayment} noValidate>
                        <DialogTitle>Record payment</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <TextField
                                    required
                                    label="Amount"
                                    type="number"
                                    inputProps={{ step: '0.01', min: '0.01' }}
                                    value={paymentForm.data.amount}
                                    onChange={(e) => paymentForm.setData('amount', e.target.value)}
                                    error={Boolean(paymentForm.errors.amount)}
                                    helperText={paymentForm.errors.amount}
                                    size="small"
                                />
                                <TextField
                                    label="Currency"
                                    size="small"
                                    value={paymentForm.data.currency}
                                    onChange={(e) => paymentForm.setData('currency', e.target.value)}
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel id="pay-method">Method</InputLabel>
                                    <Select
                                        labelId="pay-method"
                                        label="Method"
                                        value={paymentForm.data.payment_method}
                                        onChange={(e) => paymentForm.setData('payment_method', e.target.value)}
                                    >
                                        <MenuItem value="CASH">Cash</MenuItem>
                                        <MenuItem value="TRANSFER">Transfer</MenuItem>
                                        <MenuItem value="OTHER">Other</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    required
                                    label="Paid at"
                                    type="datetime-local"
                                    InputLabelProps={{ shrink: true }}
                                    value={paymentForm.data.paid_at}
                                    onChange={(e) => paymentForm.setData('paid_at', e.target.value)}
                                    error={Boolean(paymentForm.errors.paid_at)}
                                    helperText={paymentForm.errors.paid_at}
                                    size="small"
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel id="pay-line">Allocate to line (optional)</InputLabel>
                                    <Select
                                        labelId="pay-line"
                                        label="Allocate to line (optional)"
                                        value={paymentForm.data.voucher_item_id === '' ? '' : String(paymentForm.data.voucher_item_id)}
                                        onChange={(e) => paymentForm.setData('voucher_item_id', e.target.value)}
                                        displayEmpty
                                    >
                                        <MenuItem value="">
                                            <Typography variant="body2" color="text.secondary">
                                                Whole voucher
                                            </Typography>
                                        </MenuItem>
                                        {(voucher.items || []).map((it) => (
                                            <MenuItem key={it.id} value={String(it.id)}>
                                                Line {it.line_no} · {it.product?.name ?? '—'}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Reference no."
                                    size="small"
                                    value={paymentForm.data.reference_no}
                                    onChange={(e) => paymentForm.setData('reference_no', e.target.value)}
                                    error={Boolean(paymentForm.errors.reference_no)}
                                    helperText={paymentForm.errors.reference_no}
                                />
                                <TextField
                                    label="Note"
                                    size="small"
                                    multiline
                                    minRows={2}
                                    value={paymentForm.data.note}
                                    onChange={(e) => paymentForm.setData('note', e.target.value)}
                                    error={Boolean(paymentForm.errors.note)}
                                    helperText={paymentForm.errors.note}
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button type="button" onClick={() => setPaymentOpen(false)} disabled={paymentForm.processing}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="contained" disabled={paymentForm.processing}>
                                Save
                            </Button>
                        </DialogActions>
                    </Box>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
