import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Box,
    Button,
    Chip,
    Checkbox,
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
import {
    ArrowBack as ArrowBackIcon,
    DeleteOutlined as DeleteOutlinedIcon,
    EditOutlined as EditIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
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

const ADDITIONAL_COST_ICON_BUTTON_SX = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    '&:hover': {
        borderRadius: '50%',
    },
    '&.Mui-focusVisible': {
        borderRadius: '50%',
        backgroundColor: 'action.hover',
    },
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
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatQty(value) {
    if (value == null || value === '') {
        return '—';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '—';
    }
    const rounded = Math.round(n);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded);
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

function LineCard({ item, lineNo, canEdit, onEdit }) {
    const t = useT();
    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, maxWidth: '100%', minWidth: 0 }}>
            <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {t('voucher_detail.lines.line_no', { line_no: lineNo })}
                </Typography>
                {canEdit ? (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
                        <IconButton size="small" aria-label={t('voucher_detail.lines.actions.edit_line')} onClick={() => onEdit?.(item)}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Box>
                ) : null}
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {item.product?.name ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {formatQty(item.qty)} {item.unit}
                    {item.from_warehouse?.display_name ? ` · ${t('voucher_detail.lines.from_warehouse', { warehouse: item.from_warehouse.display_name })}` : ''}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {item.is_fragile ? <Chip size="small" label={t('voucher_detail.lines.fragile')} color="warning" variant="outlined" /> : null}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {t('voucher_detail.lines.freight')} {formatMoneyAmount(item.freight_amount)}{' '}
                    {item.freight_rate != null ? `(${t('voucher_detail.lines.freight_rate', { rate: formatMoneyAmount(item.freight_rate) })})` : ''}
                </Typography>
            </Stack>
        </Paper>
    );
}

export default function VoucherDetail() {
    const pageProps = usePage().props;
    const t = useT();
    const voucher = pageProps.voucher;
    const adminAppUrl = pageProps.admin_app_url;
    const canRecordVoucherPayments = pageProps.can_record_voucher_payments ?? false;
    const canManageVoucherLines = pageProps.can_manage_voucher_lines ?? false;
    const warehouses = pageProps.warehouses ?? [];
    const additionalCostCategories = pageProps.additional_cost_categories ?? [];
    const flash = pageProps.flash ?? {};

    const [paymentOpen, setPaymentOpen] = useState(false);
    const [costsOpen, setCostsOpen] = useState(false);
    const [expandedPaymentId, setExpandedPaymentId] = useState(null);
    const [lineEditOpen, setLineEditOpen] = useState(false);
    const [lineEditItem, setLineEditItem] = useState(null);
    const [additionalCostsEditOpen, setAdditionalCostsEditOpen] = useState(false);

    const paymentForm = useForm({
        amount: '',
        currency: 'MMK',
        payment_method: 'CASH',
        paid_at: '',
        reference_no: '',
        note: '',
    });

    const lineForm = useForm({
        from_warehouse_id: '',
        qty: '',
        unit: '',
        description: '',
        freight_amount: '',
        is_fragile: false,
    });
    const additionalCostsForm = useForm({
        additional_costs: [],
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

    const openLineEdit = (item) => {
        if (!canManageVoucherLines) return;
        if (!voucher?.id || !item?.id) return;
        const qtyN = Number(item.qty);
        const qty = Number.isFinite(qtyN) ? String(Math.round(qtyN)) : '';
        lineForm.setData({
            from_warehouse_id: item.from_warehouse_id != null ? String(item.from_warehouse_id) : '',
            qty,
            unit: item.unit ?? '',
            description: item.description ?? '',
            freight_amount: item.freight_amount != null && item.freight_amount !== '' ? String(Math.round(Number(item.freight_amount) || 0)) : '',
            is_fragile: Boolean(item.is_fragile),
        });
        lineForm.clearErrors();
        setLineEditItem(item);
        setLineEditOpen(true);
    };

    const closeLineEdit = () => {
        if (lineForm.processing) return;
        setLineEditOpen(false);
        setLineEditItem(null);
    };

    const openAdditionalCostsEdit = () => {
        if (!canManageVoucherLines || !voucher?.id) return;
        additionalCostsForm.setData({
            additional_costs: Array.isArray(voucher.additional_costs)
                ? voucher.additional_costs.map((c) => ({
                      category_id: c?.category_id != null ? String(c.category_id) : '',
                      category_name:
                          c?.category_name ??
                          additionalCostCategories.find((row) => Number(row.id) === Number(c?.category_id))?.name ??
                          '',
                      amount: c?.amount != null && c?.amount !== '' ? String(c.amount) : '',
                  }))
                : [],
        });
        additionalCostsForm.clearErrors();
        setAdditionalCostsEditOpen(true);
    };

    const closeAdditionalCostsEdit = () => {
        if (additionalCostsForm.processing) return;
        setAdditionalCostsEditOpen(false);
    };

    const addAdditionalCostRow = () => {
        additionalCostsForm.setData('additional_costs', [
            ...(additionalCostsForm.data.additional_costs || []),
            { category_id: '', category_name: '', amount: '' },
        ]);
    };

    const removeAdditionalCostRow = (idx) => {
        additionalCostsForm.setData(
            'additional_costs',
            (additionalCostsForm.data.additional_costs || []).filter((_, i) => i !== idx),
        );
    };

    const updateAdditionalCostRow = (idx, patch) => {
        additionalCostsForm.setData(
            'additional_costs',
            (additionalCostsForm.data.additional_costs || []).map((row, i) => (i === idx ? { ...row, ...patch } : row)),
        );
    };

    const additionalCostError = (idx, field) => additionalCostsForm.errors[`additional_costs.${idx}.${field}`];

    const submitLineEdit = (e) => {
        e.preventDefault();
        if (!voucher?.id || !lineEditItem?.id) return;
        lineForm.patch(`${adminAppUrl}/operations/vouchers/${voucher.id}/items/${lineEditItem.id}`, {
            preserveScroll: true,
            onSuccess: () => closeLineEdit(),
        });
    };

    const submitAdditionalCostsEdit = (e) => {
        e.preventDefault();
        if (!voucher?.id) return;
        additionalCostsForm.patch(`${adminAppUrl}/operations/vouchers/${voucher.id}/additional-costs`, {
            preserveScroll: true,
            onSuccess: () => closeAdditionalCostsEdit(),
        });
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

    const paymentLabels = useMemo(
        () => ({
            UNPAID: t('vouchers.payment_status.unpaid'),
            PARTIAL: t('vouchers.payment_status.partial'),
            PAID: t('vouchers.payment_status.paid'),
            WAIVED: t('vouchers.payment_status.waived'),
        }),
        [t],
    );
    const paymentMethodLabels = useMemo(
        () => ({
            CASH: t('voucher_detail.payment_methods.cash'),
            TRANSFER: t('voucher_detail.payment_methods.transfer'),
            OTHER: t('voucher_detail.payment_methods.other'),
        }),
        [t],
    );

    const layoutTitle = voucher?.voucher_no ? t('voucher_detail.title_with_no', { voucher_no: voucher.voucher_no }) : t('voucher_detail.title');

    const clientPayableTotal = useMemo(() => {
        if (!voucher?.items?.length) return null;
        return freightTotalFromItems(voucher.items) ?? 0;
    }, [voucher?.items]);

    if (!voucher) {
        return (
            <AdminLayout title={t('voucher_detail.title')}>
                <Head title={t('voucher_detail.title')} />
                <Typography variant="body2" color="text.secondary">
                    {t('ui.not_found')}
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
                        {t('voucher_detail.back_to_vouchers')}
                    </Button>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Button
                            component="a"
                            href={`${adminAppUrl}/operations/vouchers/${voucher.id}/print`}
                            target="_blank"
                            rel="noreferrer"
                            variant="outlined"
                            size="small"
                        >
                            {t('voucher_detail.actions.print')}
                        </Button>
                    </Stack>
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
                                    label={paymentLabels[voucher.payment_status] ?? voucher.payment_status}
                                    variant="outlined"
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {t('voucher_detail.read_only_hint')}
                            </Typography>
                            <Divider />
                            <KeyValueTable
                                rows={[
                                    {
                                        label: t('voucher_detail.fields.date'),
                                        value: typeof voucher.voucher_date === 'string' ? voucher.voucher_date.slice(0, 10) : voucher.voucher_date,
                                    },
                                    { label: t('voucher_detail.fields.source_warehouse'), value: voucher.source_warehouse?.display_name || '—' },
                                    { label: t('voucher_detail.fields.total_qty'), value: voucher.total_qty != null ? String(voucher.total_qty) : null },
                                    { label: t('voucher_detail.fields.weight'), value: voucher.total_weight != null ? String(voucher.total_weight) : null },
                                    { label: t('voucher_detail.fields.client_payable'), value: formatMoneyAmount(clientPayableTotal) },
                                    { label: t('voucher_detail.fields.additional_costs_internal'), value: formatMoneyAmount(additionalCostsTotal) },
                                    { label: t('voucher_detail.fields.created_by'), value: voucher.creator?.name },
                                ]}
                            />
                        </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                            {t('voucher_detail.payments.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {t('voucher_detail.payments.total_recorded')} {formatMoneyAmount(paymentsTotal)}{' '}
                            {(voucher.payments && voucher.payments[0]?.currency) || 'MMK'}
                            {clientPayableTotal != null ? (
                                <>
                                    {' '}
                                    · {t('voucher_detail.payments.expected_client_payment')} {formatMoneyAmount(clientPayableTotal)}
                                </>
                            ) : null}
                        </Typography>
                        {!canRecordVoucherPayments ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {t('voucher_detail.payments.permission_hint')}
                            </Typography>
                        ) : null}
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell width={200}>{t('voucher_detail.payments.breakdown.title')}</TableCell>
                                        <TableCell>{t('voucher_detail.payments.breakdown.cost')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {t('voucher_detail.payments.breakdown.payment_status')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{paymentLabels[voucher.payment_status] ?? voucher.payment_status ?? '—'}</TableCell>
                                    </TableRow>
                                    <TableRow hover>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {t('voucher_detail.payments.breakdown.main')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('voucher_detail.payments.breakdown.main_hint')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{formatMoneyAmount(clientPayableTotal)}</TableCell>
                                    </TableRow>
                                    <TableRow hover>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <IconButton
                                                    size="small"
                                                    sx={ADDITIONAL_COST_ICON_BUTTON_SX}
                                                    onClick={() => setCostsOpen((p) => !p)}
                                                    aria-label={costsOpen ? t('voucher_detail.payments.breakdown.collapse_additional_costs') : t('voucher_detail.payments.breakdown.expand_additional_costs')}
                                                >
                                                    {costsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                </IconButton>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {t('voucher_detail.payments.breakdown.additional_internal')}
                                                </Typography>
                                            {canManageVoucherLines ? (
                                                <IconButton
                                                    size="small"
                                                    sx={ADDITIONAL_COST_ICON_BUTTON_SX}
                                                    onClick={openAdditionalCostsEdit}
                                                    aria-label={t('voucher_detail.payments.actions.edit_additional_costs')}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            ) : null}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('voucher_detail.payments.breakdown.additional_hint')}
                                            </Typography>
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
                                                                    {c?.category_name || c?.label || '—'}
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
                                        <TableCell sx={{ fontWeight: 700 }}>{t('voucher_detail.fields.client_payable')}</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>{formatMoneyAmount(clientPayableTotal)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {canRecordVoucherPayments ? (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                                <Stack direction="row" spacing={1}>
                                    {voucher.payment_status === 'WAIVED' ? (
                                        <Button size="small" variant="outlined" onClick={() => setWaived(false)}>
                                            {t('voucher_detail.payments.actions.unwaive')}
                                        </Button>
                                    ) : (paymentsTotal <= 0.005 && voucher.payment_status !== 'PAID') ? (
                                        <Button size="small" variant="outlined" color="warning" onClick={() => setWaived(true)}>
                                            {t('voucher_detail.payments.actions.waive')}
                                        </Button>
                                    ) : null}
                                    {voucher.payment_status !== 'PAID' && voucher.payment_status !== 'WAIVED' ? (
                                        <Button size="small" variant="outlined" onClick={openPaymentDialog} disabled={clientPayableTotal == null}>
                                            {t('voucher_detail.payments.actions.record_payment')}
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Box>
                        ) : null}
                        {(voucher.payments || []).length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                {t('voucher_detail.payments.empty')}
                            </Typography>
                        ) : (
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                            <TableCell>{t('voucher_detail.payments.table.paid_at')}</TableCell>
                                            <TableCell align="right">{t('voucher_detail.payments.table.amount')}</TableCell>
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
                                                                                {t('voucher_detail.payments.details.method')} {paymentMethodLabels[p.payment_method] ?? p.payment_method ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                {t('voucher_detail.payments.details.reference')} {p.reference_no ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                {t('voucher_detail.payments.details.recorded_by')} {p.receiver?.name ?? '—'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                                {t('voucher_detail.payments.details.note')} {p.note ?? '—'}
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
                            {t('voucher_detail.merchant.title')}
                        </Typography>
                        <KeyValueTable
                            rows={[
                                { label: t('voucher_detail.merchant.name'), value: voucher.merchant?.name },
                                { label: t('voucher_detail.merchant.phone'), value: voucher.merchant?.phone },
                            ]}
                        />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                            {t('voucher_detail.default_delivery.title')}
                        </Typography>
                        <KeyValueTable
                            rows={[
                                {
                                    label: t('voucher_detail.default_delivery.to_warehouse'),
                                    value: voucher.default_to_warehouse?.display_name || null,
                                },
                                {
                                    label: t('voucher_detail.default_delivery.destination_address'),
                                    value: voucher.default_to_address_line1,
                                    preWrap: true,
                                },
                                {
                                    label: t('voucher_detail.default_delivery.destination_remark'),
                                    value: voucher.default_destination_remark,
                                    preWrap: true,
                                },
                                { label: t('voucher_detail.default_delivery.recipient_name'), value: voucher.default_recipient_name },
                                { label: t('voucher_detail.default_delivery.recipient_phone'), value: voucher.default_recipient_phone },
                            ]}
                        />
                    </Paper>
                </Box>

                {voucher.remark ? (
                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                            {t('voucher_detail.remark')}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {voucher.remark}
                        </Typography>
                    </Paper>
                ) : null}

                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                        {t('voucher_detail.lines.title')}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell width={48}>#</TableCell>
                                        <TableCell>{t('voucher_detail.lines.table.product')}</TableCell>
                                        <TableCell>{t('voucher_detail.lines.table.qty')}</TableCell>
                                        <TableCell>{t('voucher_detail.lines.table.unit')}</TableCell>
                                        <TableCell>{t('voucher_detail.lines.table.from')}</TableCell>
                                        <TableCell align="right">{t('voucher_detail.lines.table.freight')}</TableCell>
                                        <TableCell align="center">{t('voucher_detail.lines.table.fragile')}</TableCell>
                                        {canManageVoucherLines ? <TableCell align="right" width={56} /> : null}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(voucher.items || []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={canManageVoucherLines ? 8 : 7}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('voucher_detail.lines.empty')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (voucher.items || []).map((it, idx) => (
                                        <TableRow key={it.id}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{it.product?.name ?? '—'}</TableCell>
                                            <TableCell>{formatQty(it.qty)}</TableCell>
                                            <TableCell>{it.unit}</TableCell>
                                            <TableCell>{it.from_warehouse?.display_name ?? '—'}</TableCell>
                                            <TableCell align="right">{formatMoneyAmount(it.freight_amount)}</TableCell>
                                            <TableCell align="center">{it.is_fragile ? t('ui.yes') : '—'}</TableCell>
                                            {canManageVoucherLines ? (
                                                <TableCell align="right">
                                                    <IconButton size="small" aria-label={t('voucher_detail.lines.actions.edit_line')} onClick={() => openLineEdit(it)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            ) : null}
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
                                {t('voucher_detail.lines.empty')}
                            </Typography>
                        ) : (
                            (voucher.items || []).map((it, idx) => (
                                <LineCard key={it.id} item={it} lineNo={idx + 1} canEdit={canManageVoucherLines} onEdit={openLineEdit} />
                            ))
                        )}
                    </Stack>
                </Box>

                <Dialog open={lineEditOpen} onClose={closeLineEdit} fullWidth maxWidth="sm">
                    <Box component="form" onSubmit={submitLineEdit} noValidate>
                        <DialogTitle>{t('voucher_detail.lines.edit_dialog.title')}</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="line-from-wh">{t('voucher_detail.lines.table.from')}</InputLabel>
                                    <Select
                                        labelId="line-from-wh"
                                        label={t('voucher_detail.lines.table.from')}
                                        value={lineForm.data.from_warehouse_id}
                                        onChange={(e) => lineForm.setData('from_warehouse_id', e.target.value)}
                                        error={Boolean(lineForm.errors.from_warehouse_id)}
                                    >
                                        {(warehouses || []).map((w) => (
                                            <MenuItem key={w.id} value={String(w.id)}>
                                                {w.display_name || w.city}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {lineForm.errors.from_warehouse_id ? (
                                    <Typography variant="caption" color="error">
                                        {lineForm.errors.from_warehouse_id}
                                    </Typography>
                                ) : null}
                                {lineForm.errors.voucher_item ? (
                                    <Alert severity="error">{lineForm.errors.voucher_item}</Alert>
                                ) : null}
                                <TextField
                                    required
                                    label={t('voucher_detail.lines.table.qty')}
                                    type="number"
                                    inputProps={{ step: '1', min: '1' }}
                                    value={lineForm.data.qty}
                                    onChange={(e) => lineForm.setData('qty', e.target.value)}
                                    error={Boolean(lineForm.errors.qty)}
                                    helperText={lineForm.errors.qty}
                                    size="small"
                                />
                                <TextField
                                    required
                                    label={t('voucher_detail.lines.table.unit')}
                                    value={lineForm.data.unit}
                                    onChange={(e) => lineForm.setData('unit', e.target.value)}
                                    error={Boolean(lineForm.errors.unit)}
                                    helperText={lineForm.errors.unit}
                                    size="small"
                                />
                                <TextField
                                    label={t('voucher_detail.lines.edit_dialog.description')}
                                    value={lineForm.data.description}
                                    onChange={(e) => lineForm.setData('description', e.target.value)}
                                    error={Boolean(lineForm.errors.description)}
                                    helperText={lineForm.errors.description}
                                    size="small"
                                />
                                <TextField
                                    label={t('voucher_detail.lines.edit_dialog.freight_amount')}
                                    type="text"
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                                    value={lineForm.data.freight_amount}
                                    onChange={(e) => lineForm.setData('freight_amount', e.target.value.replace(/\D/g, ''))}
                                    error={Boolean(lineForm.errors.freight_amount)}
                                    helperText={lineForm.errors.freight_amount}
                                    size="small"
                                />
                                <FormControl size="small">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Checkbox
                                            checked={Boolean(lineForm.data.is_fragile)}
                                            onChange={(e) => lineForm.setData('is_fragile', e.target.checked)}
                                        />
                                        <Typography variant="body2">{t('voucher_detail.lines.fragile')}</Typography>
                                    </Stack>
                                </FormControl>
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeLineEdit} disabled={lineForm.processing}>
                                {t('ui.cancel')}
                            </Button>
                            <Button type="submit" variant="contained" disabled={lineForm.processing}>
                                {t('ui.save')}
                            </Button>
                        </DialogActions>
                    </Box>
                </Dialog>

                <Dialog open={additionalCostsEditOpen} onClose={closeAdditionalCostsEdit} fullWidth maxWidth="sm">
                    <Box component="form" onSubmit={submitAdditionalCostsEdit} noValidate>
                        <DialogTitle>{t('voucher_detail.payments.actions.edit_additional_costs')}</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                {additionalCostsForm.errors.additional_costs ? <Alert severity="error">{additionalCostsForm.errors.additional_costs}</Alert> : null}
                                {(additionalCostsForm.data.additional_costs || []).map((row, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            flexWrap: 'nowrap',
                                            overflowX: 'auto',
                                            py: 0.25,
                                        }}
                                    >
                                        <FormControl size="small" sx={{ flex: 1, minWidth: 200 }} error={Boolean(additionalCostError(idx, 'category_id'))}>
                                            <InputLabel id={`voucher-cost-cat-${idx}`}>{t('voucher_wizard.costs.category')}</InputLabel>
                                            <Select
                                                labelId={`voucher-cost-cat-${idx}`}
                                                label={t('voucher_wizard.costs.category')}
                                                value={row.category_id ?? ''}
                                                onChange={(e) => {
                                                    const id = e.target.value;
                                                    const name = additionalCostCategories.find((c) => String(c.id) === String(id))?.name ?? '';
                                                    updateAdditionalCostRow(idx, { category_id: id, category_name: name });
                                                }}
                                            >
                                                <MenuItem value="">
                                                    <em>{t('ui.select')}</em>
                                                </MenuItem>
                                                {additionalCostCategories.map((c) => (
                                                    <MenuItem key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size="small"
                                            label={t('voucher_wizard.costs.amount')}
                                            type="number"
                                            inputProps={{ step: '1', min: '0' }}
                                            sx={{ width: 140, flexShrink: 0 }}
                                            value={row.amount ?? ''}
                                            onChange={(e) => updateAdditionalCostRow(idx, { amount: e.target.value })}
                                            error={Boolean(additionalCostError(idx, 'amount'))}
                                            helperText={additionalCostError(idx, 'amount')}
                                        />
                                        <IconButton
                                            size="small"
                                            color="error"
                                            aria-label={t('voucher_wizard.costs.remove_cost')}
                                            onClick={() => removeAdditionalCostRow(idx)}
                                        >
                                            <DeleteOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))}
                                {(additionalCostsForm.data.additional_costs || []).length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {t('voucher_wizard.costs.none')}
                                    </Typography>
                                ) : null}
                                <Box>
                                    <Button variant="outlined" size="small" onClick={addAdditionalCostRow}>
                                        {t('voucher_wizard.costs.add_cost')}
                                    </Button>
                                </Box>
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeAdditionalCostsEdit} disabled={additionalCostsForm.processing}>
                                {t('ui.cancel')}
                            </Button>
                            <Button type="submit" variant="contained" disabled={additionalCostsForm.processing}>
                                {t('ui.save')}
                            </Button>
                        </DialogActions>
                    </Box>
                </Dialog>

                <Dialog open={paymentOpen} onClose={() => !paymentForm.processing && setPaymentOpen(false)} fullWidth maxWidth="sm">
                    <Box component="form" onSubmit={submitPayment} noValidate>
                        <DialogTitle>{t('voucher_detail.payments.record_dialog.title')}</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <TextField
                                    required
                                    label={t('voucher_detail.payments.record_dialog.amount')}
                                    type="number"
                                    inputProps={{ step: '1', min: '1' }}
                                    value={paymentForm.data.amount}
                                    onChange={(e) => paymentForm.setData('amount', e.target.value)}
                                    error={Boolean(paymentForm.errors.amount)}
                                    helperText={paymentForm.errors.amount}
                                    size="small"
                                />
                                <TextField
                                    label={t('voucher_detail.payments.record_dialog.currency')}
                                    size="small"
                                    value={paymentForm.data.currency}
                                    onChange={(e) => paymentForm.setData('currency', e.target.value)}
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel id="pay-method">{t('voucher_detail.payments.record_dialog.method')}</InputLabel>
                                    <Select
                                        labelId="pay-method"
                                        label={t('voucher_detail.payments.record_dialog.method')}
                                        value={paymentForm.data.payment_method}
                                        onChange={(e) => paymentForm.setData('payment_method', e.target.value)}
                                    >
                                        <MenuItem value="CASH">{t('voucher_detail.payment_methods.cash')}</MenuItem>
                                        <MenuItem value="TRANSFER">{t('voucher_detail.payment_methods.transfer')}</MenuItem>
                                        <MenuItem value="OTHER">{t('voucher_detail.payment_methods.other')}</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    required
                                    label={t('voucher_detail.payments.record_dialog.paid_at')}
                                    type="datetime-local"
                                    InputLabelProps={{ shrink: true }}
                                    value={paymentForm.data.paid_at}
                                    onChange={(e) => paymentForm.setData('paid_at', e.target.value)}
                                    error={Boolean(paymentForm.errors.paid_at)}
                                    helperText={paymentForm.errors.paid_at}
                                    size="small"
                                />
                                <TextField
                                    label={t('voucher_detail.payments.record_dialog.reference_no')}
                                    size="small"
                                    value={paymentForm.data.reference_no}
                                    onChange={(e) => paymentForm.setData('reference_no', e.target.value)}
                                    error={Boolean(paymentForm.errors.reference_no)}
                                    helperText={paymentForm.errors.reference_no}
                                />
                                <TextField
                                    label={t('voucher_detail.payments.record_dialog.note')}
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
                                {t('ui.cancel')}
                            </Button>
                            <Button type="submit" variant="contained" disabled={paymentForm.processing}>
                                {t('ui.save')}
                            </Button>
                        </DialogActions>
                    </Box>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
