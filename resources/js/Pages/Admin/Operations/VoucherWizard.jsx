import AdminLayout from '@/Layouts/AdminLayout';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { DeleteOutlined as DeleteOutlinedIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const todayStr = () => new Date().toISOString().slice(0, 10);

function WizardSection({ title, children }) {
    return (
        <Box>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1.5 }}
            >
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function PreviewField({ label, value }) {
    return (
        <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                {value != null && value !== '' ? value : '—'}
            </Typography>
        </Box>
    );
}

const emptyMerchant = () => ({
    name: '',
    phone: '',
});

const initialStep1 = () => ({
    voucher_date: todayStr(),
    source_warehouse_id: '',
    remark: '',
    payment_status: 'UNPAID',
    total_weight: '',
    additional_costs: [],
    merchant_id: null,
    merchant: emptyMerchant(),
    default_to_warehouse_id: '',
    default_to_address_line1: '',
    default_recipient_name: '',
    default_recipient_phone: '',
    default_destination_remark: '',
});

const emptyLineForm = () => ({
    product_name: '',
    qty: '1',
    unit: '',
    description: '',
    freight_amount: '',
    is_fragile: false,
});

/** Collapse internal newlines into comma-separated phrases for single-line previews. */
function destinationFieldOneLine(value) {
    if (value == null || String(value).trim() === '') return '';
    return String(value)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
}

/** Push each manually entered line as its own segment for compact cards. */
function appendPhysicalAddressLines(lines, raw) {
    if (raw == null || String(raw).trim() === '') return;
    String(raw)
        .split(/\r?\n/)
        .forEach((segment) => {
            const t = segment.trim();
            if (t) lines.push(t);
        });
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

/** One logical segment per line so narrow screens wrap naturally within width. */
function destinationLinesForMobile(it) {
    const lines = [];
    appendPhysicalAddressLines(lines, it.to_address_line1);
    appendPhysicalAddressLines(lines, it.to_address_line2);
    const loc = [it.to_township, it.to_city, it.to_region, it.to_postal_code]
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter(Boolean)
        .join(', ');
    if (loc) lines.push(loc);
    const recv = [it.recipient_name, it.recipient_phone]
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter(Boolean)
        .join(' · ');
    if (recv) lines.push(recv);
    if (lines.length === 0 && it.to_city) lines.push(String(it.to_city).trim());
    return lines.length ? lines : ['—'];
}

const destinationMobileLineSx = {
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    maxWidth: '100%',
    minWidth: 0,
};

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

function WizardLineCard({ item, onRemove }) {
    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
            <Stack spacing={1} sx={{ minWidth: 0, maxWidth: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 0, ...destinationMobileLineSx }}>
                        {item.product?.name ?? '—'}
                    </Typography>
                    <IconButton size="small" color="error" aria-label="Remove line" onClick={() => onRemove(item)} sx={{ flexShrink: 0, mt: -0.5 }}>
                        <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                </Stack>
                <Stack spacing={0.5} sx={{ minWidth: 0, maxWidth: '100%' }}>
                    <Typography variant="body2" color="text.secondary" sx={destinationMobileLineSx}>
                        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            Qty
                        </Box>{' '}
                        · {item.qty} {item.unit}
                    </Typography>
                    {item.freight_amount != null ? (
                        <Typography variant="body2" color="text.secondary" sx={destinationMobileLineSx}>
                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                Freight
                            </Box>{' '}
                            · {formatMoneyAmount(item.freight_amount)}
                        </Typography>
                    ) : null}
                    {item.description ? (
                        <Typography variant="body2" color="text.secondary" sx={{ ...destinationMobileLineSx, whiteSpace: 'pre-wrap' }}>
                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                Remark
                            </Box>{' '}
                            · {item.description}
                        </Typography>
                    ) : null}
                </Stack>
            </Stack>
        </Paper>
    );
}

function ReviewLineCard({ item, lineNo }) {
    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
            <Stack spacing={1} sx={{ minWidth: 0, maxWidth: '100%' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Line {lineNo}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, ...destinationMobileLineSx }}>
                    {item.product?.name ?? '—'}
                </Typography>
                <Typography variant="body2" sx={destinationMobileLineSx}>
                    {item.qty}{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                        {item.unit}
                    </Box>
                </Typography>
                {item.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ ...destinationMobileLineSx, whiteSpace: 'pre-wrap' }}>
                        {item.description}
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}

export default function VoucherWizard() {
    const {
        voucher = null,
        warehouses = [],
        additional_cost_categories: additionalCostCategories = [],
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
    } = usePage().props;
    const permissionCodes = auth?.permission_codes ?? [];
    const canWizard = permissionCodes.includes('vouchers.manage') && permissionCodes.includes('inventory.manage');

    const [tab, setTab] = useState(0);
    const [step1, setStep1] = useState(initialStep1);
    const [merchantMatches, setMerchantMatches] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [productOptions, setProductOptions] = useState([]);
    const [lineForm, setLineForm] = useState(() => emptyLineForm());
    const [reviewCostsOpen, setReviewCostsOpen] = useState(false);
    const [lineError, setLineError] = useState('');
    const [step1Error, setStep1Error] = useState('');
    const [processing, setProcessing] = useState(false);
    const prevTabRef = useRef(-1);

    const hydrateFromVoucher = useCallback((v) => {
        const vd = v.voucher_date;
        const dateStr = typeof vd === 'string' ? vd.slice(0, 10) : vd;
        const m = v.merchant || {};
        setStep1({
            voucher_date: dateStr || todayStr(),
            source_warehouse_id: v.source_warehouse_id != null ? String(v.source_warehouse_id) : '',
            remark: v.remark ?? '',
            payment_status: v.payment_status ?? 'UNPAID',
            total_weight: v.total_weight != null && v.total_weight !== '' ? String(v.total_weight) : '',
            additional_costs: Array.isArray(v.additional_costs)
                ? v.additional_costs.map((c) => ({
                      category_id: c?.category_id != null ? String(c.category_id) : '',
                      category_name: c?.category_name ?? '',
                      amount: c?.amount != null && c?.amount !== '' ? String(c.amount) : '',
                  }))
                : [],
            merchant_id: v.merchant_id ?? null,
            merchant: {
                name: m.name ?? '',
                phone: m.phone ?? '',
            },
            default_to_warehouse_id: v.default_to_warehouse_id != null ? String(v.default_to_warehouse_id) : '',
            default_to_address_line1: v.default_to_address_line1 ?? '',
            default_recipient_name: v.default_recipient_name ?? '',
            default_recipient_phone: v.default_recipient_phone ?? '',
            default_destination_remark: v.default_destination_remark ?? '',
        });
        setLineForm(emptyLineForm());
    }, []);

    useEffect(() => {
        if (voucher) {
            hydrateFromVoucher(voucher);
        } else {
            setStep1(initialStep1());
            setTab(0);
            setLineForm(emptyLineForm());
            setStep1Error('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset wizard shell when draft id appears/disappears
    }, [voucher?.id]);

    useEffect(() => {
        if (!voucher || typeof window === 'undefined') return;
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam === 'lines') setTab(1);
    }, [voucher?.id]);

    useEffect(() => {
        prevTabRef.current = tab;
    }, [tab]);

    const layoutTitle = voucher?.voucher_no ? `Edit ${voucher.voucher_no}` : 'New voucher';
    const layoutSubtitle = voucher?.voucher_no
        ? 'Same steps as create — changes save when you continue each step.'
        : 'Three steps. Your draft saves when you continue.';

    const additionalCostsTotal = useMemo(() => {
        let sum = 0;
        for (const row of step1.additional_costs || []) {
            const n = Number(row?.amount);
            if (Number.isFinite(n)) {
                sum += n;
            }
        }
        return Math.round(sum * 100) / 100;
    }, [step1.additional_costs]);

    const reviewTotalAmount = useMemo(() => {
        if (!voucher) {
            return null;
        }
        const freight = freightTotalFromItems(voucher.items) ?? 0;
        return Math.round((freight + additionalCostsTotal) * 100) / 100;
    }, [voucher, additionalCostsTotal]);

    const pickMerchant = (row) => {
        setStep1((p) => ({
            ...p,
            merchant_id: row.id,
            merchant: {
                name: row.name ?? '',
                phone: row.phone ?? '',
            },
        }));
    };

    const phoneDebounceRef = useRef(null);
    useEffect(() => {
        const phone = step1.merchant.phone?.trim() ?? '';
        if (!canWizard) return;
        if (phone === '') {
            setMerchantMatches([]);
            return;
        }
        window.clearTimeout(phoneDebounceRef.current);
        phoneDebounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await axios.get(`${adminAppUrl}/operations/vouchers/wizard/merchant-matches`, {
                    params: { phone },
                    headers: { Accept: 'application/json' },
                });
                const matches = data.matches || [];
                setMerchantMatches(matches);
                if (matches.length === 1) {
                    pickMerchant(matches[0]);
                }
                if (matches.length === 0) {
                    setStep1((p) => ({ ...p, merchant_id: null }));
                }
                if (matches.length > 1) {
                    setStep1((p) => ({ ...p, merchant_id: null }));
                }
            } catch {
                setMerchantMatches([]);
            }
        }, 400);
        return () => window.clearTimeout(phoneDebounceRef.current);
    }, [step1.merchant.phone, adminAppUrl, canWizard]);

    const productDebounceRef = useRef(null);
    useEffect(() => {
        if (!canWizard) {
            setProductOptions([]);
            return;
        }
        const q = (lineForm.product_name ?? '').trim();
        if (q.length < 1) {
            setProductOptions([]);
            return;
        }
        window.clearTimeout(productDebounceRef.current);
        productDebounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await axios.get(`${adminAppUrl}/operations/vouchers/wizard/product-search`, {
                    params: { q },
                    headers: { Accept: 'application/json' },
                });
                setProductOptions(data.results || []);
            } catch {
                setProductOptions([]);
            }
        }, 300);
        return () => window.clearTimeout(productDebounceRef.current);
    }, [lineForm.product_name, adminAppUrl, canWizard]);

    const buildStep1Payload = useCallback(
        (overrides = {}) => {
            const totalWeightRaw = step1.total_weight;
            const totalWeightNum = totalWeightRaw === '' || totalWeightRaw == null ? null : Number(totalWeightRaw);
            const total_weight = Number.isFinite(totalWeightNum) ? totalWeightNum : null;

            const additional_costs = (step1.additional_costs || [])
                .map((r) => ({
                    category_id: r?.category_id === '' || r?.category_id == null ? null : Number(r.category_id),
                    amount: r?.amount === '' || r?.amount == null ? null : Number(r.amount),
                }))
                .filter((r) => r.category_id != null || r.amount != null)
                .filter((r) => r.category_id != null && r.amount != null && Number.isFinite(r.amount) && r.amount >= 0)
                .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }));

            return {
                voucher_date: step1.voucher_date,
                source_warehouse_id: Number(step1.source_warehouse_id),
                total_weight,
                additional_costs,
                merchant_id: step1.merchant_id ?? voucher?.merchant_id ?? null,
                merchant: {
                    name: step1.merchant.name,
                    phone: step1.merchant.phone || null,
                },
                default_to_warehouse_id: Number(step1.default_to_warehouse_id),
                default_to_address_line1: step1.default_to_address_line1?.trim() || null,
                default_recipient_name: step1.default_recipient_name?.trim() || null,
                default_recipient_phone: step1.default_recipient_phone?.trim() || null,
                default_destination_remark: step1.default_destination_remark?.trim() || null,
                ...overrides,
            };
        },
        [step1, voucher?.merchant_id],
    );

    const submitStep1 = () => {
        if (!canWizard) return;
        setStep1Error('');
        if (!step1.default_to_warehouse_id) {
            setStep1Error('Select destination warehouse.');
            return;
        }
        setProcessing(true);
        const payload = buildStep1Payload();
        const opts = { preserveScroll: true, onFinish: () => setProcessing(false) };
        if (voucher) {
            router.patch(`${adminAppUrl}/operations/vouchers/${voucher.id}/wizard/step1`, payload, opts);
        } else {
            router.post(`${adminAppUrl}/operations/vouchers/wizard/step1`, { ...payload, merchant_id: step1.merchant_id }, opts);
        }
    };

    const submitLine = () => {
        if (!canWizard || !voucher) return;
        setLineError('');
        const qty = parseFloat(lineForm.qty);
        if (!Number.isFinite(qty) || qty <= 0) return;

        if (!lineForm.product_name?.trim()) {
            return;
        }
        if (!lineForm.unit?.trim()) return;

        const parseOpt = (v) => {
            if (v === '' || v == null) return null;
            const n = Number.parseFloat(String(v));
            return Number.isFinite(n) ? n : null;
        };

        const base = {
            product_name: lineForm.product_name.trim(),
            qty,
            unit: lineForm.unit,
            description: lineForm.description?.trim() || null,
            freight_amount: parseOpt(lineForm.freight_amount),
            is_fragile: lineForm.is_fragile,
        };

        const payload = { ...base };

        setProcessing(true);
        router.post(`${adminAppUrl}/operations/vouchers/${voucher.id}/wizard/lines`, payload, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setProductOptions([]);
                setLineError('');
                setLineForm(emptyLineForm());
            },
        });
    };

    const removeLine = (item) => {
        if (!canWizard || !voucher) return;
        if (!window.confirm('Remove this line?')) return;
        router.delete(`${adminAppUrl}/operations/vouchers/${voucher.id}/wizard/lines/${item.id}`, { preserveScroll: true });
    };

    const finish = () => {
        if (!canWizard || !voucher) return;
        setProcessing(true);

        const totalWeightRaw = step1.total_weight;
        const totalWeightNum = totalWeightRaw === '' || totalWeightRaw == null ? null : Number(totalWeightRaw);
        const total_weight = Number.isFinite(totalWeightNum) ? totalWeightNum : null;

        const additional_costs = (step1.additional_costs || [])
            .map((r) => ({
                category_id: r?.category_id ? Number(r.category_id) : null,
                amount: r?.amount != null && r?.amount !== '' ? Number(r.amount) : null,
            }))
            .filter((r) => r.category_id != null && r.amount != null && Number.isFinite(r.amount) && r.amount >= 0)
            .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }));

        router.post(
            `${adminAppUrl}/operations/vouchers/${voucher.id}/wizard/finish`,
            {
                payment_status: step1.payment_status,
                remark: step1.remark?.trim() || null,
                total_weight,
                additional_costs,
            },
            { preserveScroll: true, onFinish: () => setProcessing(false) },
        );
    };

    const addCostRow = () => {
        setStep1((p) => ({
            ...p,
            additional_costs: [...(p.additional_costs || []), { category_id: '', category_name: '', amount: '' }],
        }));
    };

    const removeCostRow = (idx) => {
        setStep1((p) => ({
            ...p,
            additional_costs: (p.additional_costs || []).filter((_, i) => i !== idx),
        }));
    };

    const updateCostRow = (idx, patch) => {
        setStep1((p) => ({
            ...p,
            additional_costs: (p.additional_costs || []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        }));
    };

    const tabDisabled = (idx) => {
        if (idx === 0) return false;
        if (idx === 1) return !voucher;
        if (idx === 2) return !voucher;
        return false;
    };

    if (!canWizard) {
        return (
            <AdminLayout title={layoutTitle}>
                <Head title={layoutTitle} />
                <Alert severity="warning" sx={{ mb: 2 }}>
                    You need both <strong>vouchers.manage</strong> and <strong>inventory.manage</strong> to use the voucher wizard.
                </Alert>
                <Button component={Link} href={`${adminAppUrl}/operations/vouchers`} variant="contained">
                    Back to vouchers
                </Button>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={layoutTitle}>
            <Head title={layoutTitle} />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                            {layoutTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 520 }}>
                            {layoutSubtitle}
                        </Typography>
                    </Box>
                    <Button component={Link} href={`${adminAppUrl}/operations/vouchers`} variant="text" size="small" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, flexShrink: 0 }}>
                        ← Vouchers
                    </Button>
                </Stack>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            px: { xs: 1, sm: 2 },
                            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'grey.50'),
                            minHeight: 48,
                            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
                        }}
                    >
                        <Tab label="1 · Details" disabled={false} />
                        <Tab label="2 · Lines" disabled={tabDisabled(1)} />
                        <Tab label="3 · Review" disabled={tabDisabled(2)} />
                    </Tabs>
                    <Divider />
                    <Box sx={{ p: { xs: 2, sm: 3 } }}>
                        {tab === 0 && (
                            <Stack spacing={3}>
                                {step1Error ? (
                                    <Alert severity="warning" sx={{ py: 0.75 }} onClose={() => setStep1Error('')}>
                                        {step1Error}
                                    </Alert>
                                ) : null}
                                <WizardSection title="Voucher">
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
                                        <TextField
                                            label="Date"
                                            type="date"
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            value={step1.voucher_date}
                                            onChange={(e) => setStep1((p) => ({ ...p, voucher_date: e.target.value }))}
                                            sx={{ width: { xs: '100%', sm: 160 } }}
                                        />
                                        <FormControl fullWidth size="small" sx={{ flex: 1, minWidth: 0 }}>
                                            <InputLabel id="wh-label">Source warehouse</InputLabel>
                                            <Select
                                                labelId="wh-label"
                                                label="Source warehouse"
                                                value={step1.source_warehouse_id}
                                                onChange={(e) => setStep1((p) => ({ ...p, source_warehouse_id: e.target.value }))}
                                            >
                                                <MenuItem value="">
                                                    <em>Select…</em>
                                                </MenuItem>
                                                {warehouses.map((w) => (
                                                    <MenuItem key={w.id} value={String(w.id)}>
                                                        {w.display_name || w.city}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </WizardSection>

                                <WizardSection title="Merchant">
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Phone"
                                            size="small"
                                            fullWidth
                                            value={step1.merchant.phone}
                                            onChange={(e) => setStep1((p) => ({ ...p, merchant: { ...p.merchant, phone: e.target.value } }))}
                                            helperText={merchantMatches.length > 1 ? 'Several matches — use Pick merchant.' : 'Used to find an existing merchant'}
                                        />
                                        {merchantMatches.length > 1 && (
                                            <Alert severity="info" sx={{ py: 0.5 }} icon={false}>
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                                                    <Typography variant="body2">Multiple merchants use this phone.</Typography>
                                                    <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)}>
                                                        Pick merchant
                                                    </Button>
                                                </Stack>
                                            </Alert>
                                        )}
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                            <TextField
                                                label="Name"
                                                required
                                                size="small"
                                                fullWidth
                                                value={step1.merchant.name}
                                                onChange={(e) => setStep1((p) => ({ ...p, merchant: { ...p.merchant, name: e.target.value } }))}
                                            />
                                        </Stack>
                                    </Stack>
                                </WizardSection>

                                <WizardSection title="Default delivery destination">
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
                                        Required for this voucher.
                                    </Typography>
                                    <Stack spacing={2}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel id="def-to-wh">Destination warehouse</InputLabel>
                                            <Select
                                                labelId="def-to-wh"
                                                label="Destination warehouse"
                                                value={step1.default_to_warehouse_id}
                                                onChange={(e) => setStep1((p) => ({ ...p, default_to_warehouse_id: e.target.value }))}
                                            >
                                                <MenuItem value="">
                                                    <em>Select…</em>
                                                </MenuItem>
                                                {warehouses.map((w) => (
                                                    <MenuItem key={w.id} value={String(w.id)}>
                                                        {w.display_name || w.city}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            label="Destination address"
                                            size="small"
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            inputProps={{ maxLength: 500 }}
                                            value={step1.default_to_address_line1}
                                            onChange={(e) => setStep1((p) => ({ ...p, default_to_address_line1: e.target.value }))}
                                        />
                                        <TextField
                                            label="Destination remark"
                                            size="small"
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            value={step1.default_destination_remark}
                                            onChange={(e) => setStep1((p) => ({ ...p, default_destination_remark: e.target.value }))}
                                        />
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                            <TextField
                                                label="Recipient name"
                                                size="small"
                                                fullWidth
                                                value={step1.default_recipient_name}
                                                onChange={(e) => setStep1((p) => ({ ...p, default_recipient_name: e.target.value }))}
                                            />
                                            <TextField
                                                label="Recipient phone"
                                                size="small"
                                                fullWidth
                                                value={step1.default_recipient_phone}
                                                onChange={(e) => setStep1((p) => ({ ...p, default_recipient_phone: e.target.value }))}
                                            />
                                        </Stack>
                                    </Stack>
                                </WizardSection>

                                <Divider />
                                <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end" alignItems={{ xs: 'stretch', sm: 'center' }}>
                                    {voucher && (
                                        <Button variant="text" onClick={() => setTab(1)}>
                                            Skip to lines
                                        </Button>
                                    )}
                                    <Button variant="contained" disabled={processing} onClick={submitStep1} sx={{ minWidth: 160 }}>
                                        {voucher ? 'Save' : 'Continue'}
                                    </Button>
                                </Stack>
                            </Stack>
                        )}

                        {tab === 1 && voucher && (
                            <Stack spacing={3}>
                                <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                        Draft
                                    </Typography>
                                    <Chip size="small" label={voucher.voucher_no} variant="outlined" sx={{ fontWeight: 600 }} />
                                </Stack>

                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'grey.50'),
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 2 }}>
                                        Add line
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Autocomplete
                                            size="small"
                                            freeSolo
                                            options={productOptions}
                                            getOptionLabel={(o) => {
                                                if (typeof o === 'string') return o;
                                                return (o?.sku ? `${o.name} (${o.sku})` : o?.name) || '';
                                            }}
                                            value={null}
                                            inputValue={lineForm.product_name}
                                            onInputChange={(_, v) => setLineForm((p) => ({ ...p, product_name: v }))}
                                            onChange={(_, v) => {
                                                if (typeof v === 'string') {
                                                    setLineForm((p) => ({ ...p, product_name: v }));
                                                    return;
                                                }
                                                if (v && typeof v === 'object') {
                                                    setLineForm((p) => ({
                                                        ...p,
                                                        product_name: v.name ?? p.product_name,
                                                        unit: v.unit || p.unit,
                                                    }));
                                                }
                                            }}
                                            filterOptions={(opts) => opts}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Product"
                                                    placeholder="Type product name"
                                                    helperText="If product name exists, it will be used. If not, a new product will be created when you add the line."
                                                />
                                            )}
                                        />

                                        {lineError ? (
                                            <Alert severity="warning" sx={{ py: 0.5 }} onClose={() => setLineError('')}>
                                                {lineError}
                                            </Alert>
                                        ) : null}

                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                            <TextField
                                                label="Qty"
                                                type="number"
                                                size="small"
                                                sx={{ width: { xs: '100%', sm: 120 } }}
                                                value={lineForm.qty}
                                                onChange={(e) => setLineForm((p) => ({ ...p, qty: e.target.value }))}
                                            />
                                            <TextField
                                                label="Unit"
                                                size="small"
                                                sx={{ width: { xs: '100%', sm: 140 } }}
                                                value={lineForm.unit}
                                                onChange={(e) => setLineForm((p) => ({ ...p, unit: e.target.value }))}
                                            />
                                        </Stack>
                                        <Stack spacing={0.75}>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                                <TextField
                                                    label="Freight amount"
                                                    type="number"
                                                    size="small"
                                                    fullWidth
                                                    value={lineForm.freight_amount}
                                                    onChange={(e) => setLineForm((p) => ({ ...p, freight_amount: e.target.value }))}
                                                    helperText="Enter freight amount directly (optional)."
                                                />
                                            </Stack>
                                        </Stack>
                                        <TextField
                                            label="Remark"
                                            size="small"
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            value={lineForm.description}
                                            onChange={(e) => setLineForm((p) => ({ ...p, description: e.target.value }))}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={lineForm.is_fragile}
                                                    onChange={(e) => setLineForm((p) => ({ ...p, is_fragile: e.target.checked }))}
                                                />
                                            }
                                            label={<Typography variant="body2">Fragile</Typography>}
                                        />
                                        <Box>
                                            <Button variant="contained" disabled={processing} onClick={submitLine}>
                                                Add line
                                            </Button>
                                        </Box>
                                    </Stack>
                                </Paper>

                                <WizardSection title="Lines">
                                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                        <TableContainer
                                            component={Paper}
                                            variant="outlined"
                                            sx={{ borderRadius: 2, maxWidth: '100%' }}
                                        >
                                            <Table size="small" sx={{ minWidth: 520 }}>
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                                        <TableCell width={48}>No</TableCell>
                                                        <TableCell>Product</TableCell>
                                                        <TableCell>Qty</TableCell>
                                                        <TableCell>Unit</TableCell>
                                                        <TableCell align="right">Freight</TableCell>
                                                        <TableCell>Remark</TableCell>
                                                        <TableCell align="right" width={56} />
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {(voucher.items || []).map((it, idx) => (
                                                        <TableRow key={it.id} hover>
                                                            <TableCell>{idx + 1}</TableCell>
                                                            <TableCell sx={{ fontWeight: 500 }}>{it.product?.name ?? '—'}</TableCell>
                                                            <TableCell>
                                                                {it.qty}
                                                            </TableCell>
                                                            <TableCell>{it.unit}</TableCell>
                                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                                {formatMoneyAmount(it.freight_amount)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                    {it.description || '—'}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <IconButton size="small" color="error" aria-label="Remove line" onClick={() => removeLine(it)}>
                                                                    <DeleteOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {(!voucher.items || voucher.items.length === 0) && (
                                                        <TableRow>
                                                            <TableCell colSpan={7}>
                                                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                                    No lines yet.
                                                                </Typography>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                    <Stack spacing={1.25} sx={{ display: { xs: 'flex', sm: 'none' }, width: '100%', minWidth: 0 }}>
                                        {(voucher.items || []).length === 0 ? (
                                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No lines yet.
                                                </Typography>
                                            </Paper>
                                        ) : (
                                            (voucher.items || []).map((it) => <WizardLineCard key={it.id} item={it} onRemove={removeLine} />)
                                        )}
                                    </Stack>
                                </WizardSection>

                                <Divider />
                                <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                                    <Button variant="text" size="small" onClick={() => setTab(0)}>
                                        ← Details
                                    </Button>
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <Button variant="outlined" size="small" onClick={() => setTab(2)} disabled={!voucher.items?.length}>
                                            Review
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Stack>
                        )}

                        {tab === 2 && voucher && (
                            <Stack spacing={3}>
                                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                                    Review
                                </Typography>
                                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                                    <Stack spacing={2.5}>
                                        <WizardSection title="Voucher basic info">
                                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                                <Table size="small">
                                                    <TableBody>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Voucher
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 700, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                                                {voucher.voucher_no ?? '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Date
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {typeof voucher.voucher_date === 'string'
                                                                    ? voucher.voucher_date.slice(0, 10)
                                                                    : voucher.voucher_date || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Warehouse
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.source_warehouse?.name || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Total amount
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>{formatMoneyAmount(reviewTotalAmount)}</TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </WizardSection>

                                        <Divider />

                                        <WizardSection title="Weight & additional costs">
                                            <Stack spacing={2}>
                                                <TextField
                                                    size="small"
                                                    label="Voucher weight"
                                                    type="number"
                                                    inputProps={{ step: '0.001', min: '0' }}
                                                    sx={{ width: { xs: '100%', sm: 220 } }}
                                                    value={step1.total_weight}
                                                    onChange={(e) => setStep1((p) => ({ ...p, total_weight: e.target.value }))}
                                                    helperText="Optional (manual)."
                                                />

                                                <Divider />

                                                <Stack spacing={1.25}>
                                                    <Stack
                                                        direction="row"
                                                        alignItems="center"
                                                        justifyContent="flex-start"
                                                        flexWrap="nowrap"
                                                        gap={1}
                                                        sx={{ width: '100%', overflowX: 'auto' }}
                                                    >
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            Additional costs
                                                        </Typography>
                                                        <Button variant="outlined" size="small" onClick={addCostRow} sx={{ ml: 'auto', flexShrink: 0 }}>
                                                            Add cost
                                                        </Button>
                                                    </Stack>

                                                    {(step1.additional_costs || []).length === 0 ? (
                                                        <Typography variant="body2" color="text.secondary">
                                                            No additional costs.
                                                        </Typography>
                                                    ) : (
                                                        <Stack spacing={1}>
                                                            {(step1.additional_costs || []).map((row, idx) => (
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
                                                                    <FormControl size="small" sx={{ flex: 1, minWidth: 200 }}>
                                                                        <InputLabel id={`cost-cat-review-${idx}`}>Category</InputLabel>
                                                                        <Select
                                                                            labelId={`cost-cat-review-${idx}`}
                                                                            label="Category"
                                                                            value={row.category_id ?? ''}
                                                                            onChange={(e) => {
                                                                                const id = e.target.value;
                                                                                const name =
                                                                                    additionalCostCategories.find((c) => String(c.id) === String(id))?.name ?? '';
                                                                                updateCostRow(idx, { category_id: id, category_name: name });
                                                                            }}
                                                                        >
                                                                            <MenuItem value="">
                                                                                <em>Select…</em>
                                                                            </MenuItem>
                                                                            {additionalCostCategories
                                                                                .filter((c) => c.status === 'ACTIVE')
                                                                                .map((c) => (
                                                                                    <MenuItem key={c.id} value={String(c.id)}>
                                                                                        {c.name}
                                                                                    </MenuItem>
                                                                                ))}
                                                                        </Select>
                                                                    </FormControl>
                                                                    <TextField
                                                                        size="small"
                                                                        label="Amount"
                                                                        type="number"
                                                                        inputProps={{ step: '0.01', min: '0' }}
                                                                        sx={{ width: 140, flexShrink: 0 }}
                                                                        value={row.amount}
                                                                        onChange={(e) => updateCostRow(idx, { amount: e.target.value })}
                                                                    />
                                                                    <IconButton size="small" color="error" aria-label="Remove cost" onClick={() => removeCostRow(idx)}>
                                                                        <DeleteOutlinedIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    )}

                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                        Additional costs total: {formatMoneyAmount(additionalCostsTotal)}
                                                    </Typography>
                                                </Stack>
                                            </Stack>
                                        </WizardSection>

                                        <Divider />

                                        <WizardSection title="Merchant">
                                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                                <Table size="small">
                                                    <TableBody>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Name
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.merchant?.name || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Phone
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.merchant?.phone || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </WizardSection>

                                        <Divider />

                                        <WizardSection title="Deliver">
                                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                                <Table size="small">
                                                    <TableBody>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                To warehouse
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.default_to_warehouse_id
                                                                    ? warehouses.find((w) => Number(w.id) === Number(voucher.default_to_warehouse_id))
                                                                          ?.display_name ??
                                                                      '—'
                                                                    : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Destination address
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                                {step1.default_to_address_line1?.trim() || voucher.default_to_address_line1 || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Destination remark
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                                {step1.default_destination_remark?.trim() || voucher.default_destination_remark || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Recipient name
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.default_recipient_name || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow hover>
                                                            <TableCell width={180} sx={{ color: 'text.secondary' }}>
                                                                Recipient phone
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                                {voucher.default_recipient_phone || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </WizardSection>

                                        <Divider />

                                        <WizardSection title="Payment">
                                            <Stack spacing={2}>
                                                <FormControl fullWidth size="small" sx={{ maxWidth: { sm: 360 } }}>
                                                    <InputLabel id="pay-label-review">Payment status</InputLabel>
                                                    <Select
                                                        labelId="pay-label-review"
                                                        label="Payment status"
                                                        value={step1.payment_status}
                                                        onChange={(e) => setStep1((p) => ({ ...p, payment_status: e.target.value }))}
                                                    >
                                                        {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                                                            <MenuItem key={value} value={value}>
                                                                {label}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>

                                                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow
                                                                sx={{
                                                                    bgcolor: (theme) =>
                                                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                                                                }}
                                                            >
                                                                <TableCell width={200}>Title</TableCell>
                                                                <TableCell>Cost</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
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
                                                                            onClick={() => setReviewCostsOpen((p) => !p)}
                                                                            aria-label={reviewCostsOpen ? 'Collapse additional costs' : 'Expand additional costs'}
                                                                        >
                                                                            {reviewCostsOpen ? (
                                                                                <ExpandLessIcon fontSize="small" />
                                                                            ) : (
                                                                                <ExpandMoreIcon fontSize="small" />
                                                                            )}
                                                                        </IconButton>
                                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                            Additional
                                                                        </Typography>
                                                                    </Stack>
                                                                </TableCell>
                                                                <TableCell>{formatMoneyAmount(additionalCostsTotal)}</TableCell>
                                                            </TableRow>
                                                            {reviewCostsOpen && (step1.additional_costs || []).length > 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={2} sx={{ py: 1.25 }}>
                                                                        <Table size="small" sx={{ minWidth: 360 }}>
                                                                            <TableBody>
                                                                                {(step1.additional_costs || []).map((c, idx) => (
                                                                                    <TableRow key={idx} hover>
                                                                                        <TableCell sx={{ borderBottom: 0, color: 'text.secondary' }}>
                                                                                            {c.category_name || '—'}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ borderBottom: 0 }}>
                                                                                            {formatMoneyAmount(c.amount)}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : null}
                                                            <TableRow hover>
                                                                <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                                                                <TableCell sx={{ fontWeight: 700 }}>{formatMoneyAmount(reviewTotalAmount)}</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>

                                                <TextField
                                                    label="Remark"
                                                    size="small"
                                                    fullWidth
                                                    multiline
                                                    minRows={2}
                                                    value={step1.remark}
                                                    onChange={(e) => setStep1((p) => ({ ...p, remark: e.target.value }))}
                                                />
                                            </Stack>
                                        </WizardSection>
                                    </Stack>
                                </Paper>

                                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxWidth: '100%' }}>
                                        <Table size="small" sx={{ minWidth: 480 }}>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                                    <TableCell width={48}>No</TableCell>
                                                    <TableCell>Product</TableCell>
                                                    <TableCell>Qty</TableCell>
                                                    <TableCell>Unit</TableCell>
                                                    <TableCell align="right">Freight</TableCell>
                                                    <TableCell>Remark</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {(voucher.items || []).map((it, idx) => (
                                                    <TableRow key={it.id} hover>
                                                        <TableCell>{idx + 1}</TableCell>
                                                        <TableCell sx={{ fontWeight: 500 }}>{it.product?.name ?? '—'}</TableCell>
                                                        <TableCell>{it.qty}</TableCell>
                                                        <TableCell>{it.unit}</TableCell>
                                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                            {formatMoneyAmount(it.freight_amount)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                {it.description || '—'}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                                <Stack spacing={1.25} sx={{ display: { xs: 'flex', sm: 'none' }, width: '100%', minWidth: 0 }}>
                                    {(voucher.items || []).map((it, idx) => (
                                        <ReviewLineCard key={it.id} item={it} lineNo={idx + 1} />
                                    ))}
                                </Stack>
                                {!voucher.items?.length && (
                                    <Alert severity="warning" sx={{ py: 0.75 }}>
                                        Add at least one line before confirming.
                                    </Alert>
                                )}
                                <Alert severity="info" sx={{ py: 0.75 }}>
                                    <Typography variant="body2">
                                        Confirming locks this voucher for editing in the wizard. Next steps (trips, loading, delivery) will use operational screens per roadmap.
                                    </Typography>
                                </Alert>
                                <Divider />
                                <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                                    <Stack direction="row" spacing={1}>
                                        <Button variant="text" size="small" onClick={() => setTab(1)}>
                                            ← Lines
                                        </Button>
                                        <Button variant="text" size="small" onClick={() => setTab(0)}>
                                            Details
                                        </Button>
                                    </Stack>
                                    <Button variant="contained" disabled={processing || !voucher.items?.length} onClick={finish} sx={{ minWidth: 160 }}>
                                        Confirm voucher
                                    </Button>
                                </Stack>
                            </Stack>
                        )}
                    </Box>
                </Paper>

                <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2 } }}>
                    <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Select merchant</DialogTitle>
                    <DialogContent dividers sx={{ py: 0 }}>
                        <List dense>
                            {merchantMatches.map((m) => (
                                <ListItemButton
                                    key={m.id}
                                    onClick={() => {
                                        pickMerchant(m);
                                        setPickerOpen(false);
                                    }}
                                >
                                    <ListItemText primary={m.name} secondary={m.phone || null} />
                                </ListItemButton>
                            ))}
                        </List>
                    </DialogContent>
                    <DialogActions sx={{ px: 2, py: 1.5 }}>
                        <Button onClick={() => setPickerOpen(false)} color="inherit">
                            Cancel
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
