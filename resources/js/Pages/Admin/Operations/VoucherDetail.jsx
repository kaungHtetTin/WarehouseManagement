import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
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
import { ArrowBack as ArrowBackIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Fragment, useMemo, useState } from 'react';

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

function KeyValueTable({ rows }) {
    return (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
                <TableBody>
                    {(rows || []).map((r, idx) => {
                        const raw = r?.value;
                        const isEmpty =
                            raw == null ||
                            raw === '' ||
                            (typeof raw === 'string' && raw.trim() === '');
                        const value = isEmpty ? '—' : raw;

                        return (
                            <TableRow key={idx} hover>
                                <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                    {r?.label}
                                </TableCell>
                                <TableCell
                                    sx={{
                                        fontWeight: 600,
                                        wordBreak: 'break-word',
                                        overflowWrap: 'anywhere',
                                        whiteSpace: r?.preWrap ? 'pre-wrap' : 'normal',
                                        ...((r?.valueSx ?? {}) || {}),
                                    }}
                                >
                                    {value}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
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
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {item.is_fragile ? <Chip size="small" label="Fragile" color="warning" variant="outlined" /> : null}
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
    const [costsOpen, setCostsOpen] = useState(false);
    const [expandedPaymentId, setExpandedPaymentId] = useState(null);

    const paymentForm = useForm({
        amount: '',
        currency: 'MMK',
        payment_method: 'CASH',
        paid_at: '',
        reference_no: '',
        note: '',
    });

    const openPaymentDialog = () => {
        paymentForm.setData({
            amount: '',
            currency: 'MMK',
            payment_method: 'CASH',
            paid_at: toDatetimeLocalValue(new Date()),
            reference_no: '',
            note: '',
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

    const setWaived = (waived) => {
        if (!voucher?.id) return;
        router.post(
            `${adminAppUrl}/operations/vouchers/${voucher.id}/payment-waive`,
            { waived: Boolean(waived) },
            { preserveScroll: true },
        );
    };

    const paymentsTotal = useMemo(() => {
        let s = 0;
        for (const p of voucher?.payments || []) {
            const n = Number(p?.amount);
            if (Number.isFinite(n)) s += n;
        }
        return Math.round(s * 100) / 100;
    }, [voucher?.payments]);

    const additionalCostsTotal = useMemo(() => {
        let sum = 0;
        const rows = voucher?.additional_costs;
        if (!Array.isArray(rows)) return 0;
        for (const r of rows) {
            const n = Number(r?.amount);
            if (Number.isFinite(n) && n > 0) sum += n;
        }
        return Math.round(sum * 100) / 100;
    }, [voucher?.additional_costs]);

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

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2.5,
                        alignItems: 'start',
                    }}
                >
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
                            <KeyValueTable
                                rows={[
                                    {
                                        label: 'Date',
                                        value: typeof voucher.voucher_date === 'string' ? voucher.voucher_date.slice(0, 10) : voucher.voucher_date,
                                    },
                                    { label: 'Source warehouse', value: voucher.source_warehouse?.name },
                                    { label: 'Total qty', value: voucher.total_qty != null ? String(voucher.total_qty) : null },
                                    { label: 'Weight', value: voucher.total_weight != null ? String(voucher.total_weight) : null },
                                    { label: 'Total amount', value: formatMoneyAmount(totalAmountDisplay) },
                                    { label: 'Created by', value: voucher.creator?.name },
                                ]}
                            />
                        </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                            Payments
                        </Typography>
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
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell width={200}>Title</TableCell>
                                        <TableCell>Cost</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                Payment status
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{PAYMENT_LABELS[voucher.payment_status] ?? voucher.payment_status ?? '—'}</TableCell>
                                    </TableRow>
                                    <TableRow hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                Main
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Freight cost for all line
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{formatMoneyAmount(freightTotalFromItems(voucher.items) ?? 0)}</TableCell>
                                    </TableRow>
                                    <TableRow hover>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setCostsOpen((p) => !p)}
                                                    aria-label={costsOpen ? 'Collapse additional costs' : 'Expand additional costs'}
                                                >
                                                    {costsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                </IconButton>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    Additional
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{formatMoneyAmount(additionalCostsTotal)}</TableCell>
                                    </TableRow>
                                    {costsOpen && Array.isArray(voucher.additional_costs) && voucher.additional_costs.length > 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2} sx={{ py: 1.25 }}>
                                                <Table size="small" sx={{ minWidth: 360 }}>
                                                    <TableBody>
                                                        {voucher.additional_costs.map((c, idx) => (
                                                            <TableRow key={idx} hover>
                                                                <TableCell sx={{ borderBottom: 0, color: 'text.secondary' }}>
                                                                    {c?.label || '—'}
                                                                </TableCell>
                                                                <TableCell sx={{ borderBottom: 0 }}>{formatMoneyAmount(c?.amount)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                    <TableRow hover>
                                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{formatMoneyAmount(totalAmountDisplay ?? 0)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {canRecordVoucherPayments ? (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                                <Stack direction="row" spacing={1}>
                                    {voucher.payment_status === 'WAIVED' ? (
                                        <Button size="small" variant="outlined" onClick={() => setWaived(false)}>
                                            Unwaive
                                        </Button>
                                    ) : (paymentsTotal <= 0.005 && voucher.payment_status !== 'PAID') ? (
                                        <Button size="small" variant="outlined" color="warning" onClick={() => setWaived(true)}>
                                            Waive
                                        </Button>
                                    ) : null}
                                    {voucher.payment_status !== 'PAID' && voucher.payment_status !== 'WAIVED' ? (
                                        <Button size="small" variant="outlined" onClick={openPaymentDialog} disabled={voucher.total_amount == null}>
                                            Record payment
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Box>
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
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(voucher.payments || []).map((p) => {
                                            const hasDetails = Boolean(p.payment_method || p.reference_no || p.receiver?.name || p.note);
                                            const isExpanded = expandedPaymentId === p.id;

                                            return (
                                                <Fragment key={p.id}>
                                                    <TableRow hover>
                                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                                {hasDetails ? (
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => setExpandedPaymentId((prev) => (prev === p.id ? null : p.id))}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ExpandLessIcon fontSize="small" />
                                                                        ) : (
                                                                            <ExpandMoreIcon fontSize="small" />
                                                                        )}
                                                                    </IconButton>
                                                                ) : null}
                                                                <Typography variant="body2">
                                                                    {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {formatMoneyAmount(p.amount)} {p.currency ?? 'MMK'}
                                                        </TableCell>
                                                    </TableRow>
                                                    {hasDetails ? (
                                                        <TableRow>
                                                            <TableCell colSpan={2} sx={{ py: 0 }}>
                                                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                                    <Box sx={{ px: 2, py: 1.5 }}>
                                                                        <Stack spacing={0.75}>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                Method: {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                Reference: {p.reference_no ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                Recorded by: {p.receiver?.name ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                                Note: {p.note ?? '—'}
                                                                            </Typography>
                                                                        </Stack>
                                                                    </Box>
                                                                </Collapse>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>

                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                            Merchant
                        </Typography>
                        <KeyValueTable
                            rows={[
                                { label: 'Name', value: voucher.merchant?.name },
                                { label: 'Phone', value: voucher.merchant?.phone },
                                { label: 'NRC / ID', value: voucher.merchant?.nrc_or_id },
                                { label: 'Address', value: voucher.merchant?.address, preWrap: true },
                            ]}
                        />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                            Default delivery (summary)
                        </Typography>
                        <KeyValueTable
                            rows={[
                                {
                                    label: 'To warehouse',
                                    value: voucher.default_to_warehouse ? `${voucher.default_to_warehouse.name} (${voucher.default_to_warehouse.code})` : null,
                                },
                                {
                                    label: 'Shipping address',
                                    value: [voucher.default_to_address_line1, voucher.default_to_city].filter(Boolean).join(' · '),
                                    preWrap: true,
                                },
                                { label: 'Recipient name', value: voucher.default_recipient_name },
                                { label: 'Recipient phone', value: voucher.default_recipient_phone },
                            ]}
                        />
                    </Paper>
                </Box>

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
                                        <TableCell align="right">Freight</TableCell>
                                        <TableCell align="center">Fragile</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(voucher.items || []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7}>
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
                                            <TableCell align="right">{formatMoneyAmount(it.freight_amount)}</TableCell>
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
