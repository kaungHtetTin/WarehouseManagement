import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import { voucherPaymentStatusLabel } from '@/utils/statusLabels';
import { ExpandLessOutlined as ExpandLessIcon, ExpandMoreOutlined as ExpandMoreIcon } from '@mui/icons-material';
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
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Fragment, useMemo, useState } from 'react';

const SECTION_CARD_SX = {
    borderRadius: 1.5,
    boxShadow: 'none',
};

function remainingQty(row) {
    return Math.max(0, Number(row.qty_received ?? 0) - Number(row.qty_dispatched ?? 0));
}

function formatInt(value) {
    if (value == null || value === '') {
        return '—';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
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

function buildShippingInfo(v) {
    if (!v) {
        return { recipient: '—', address: '—', full: '—' };
    }

    const recipientBits = [];
    if (v.default_recipient_name) {
        recipientBits.push(v.default_recipient_name);
    }
    if (v.default_recipient_phone) {
        recipientBits.push(v.default_recipient_phone);
    }
    const recipient = recipientBits.length ? recipientBits.join(' · ') : '—';

    const addrBits = [];
    const wh = v.default_to_warehouse;
    if (wh?.name) {
        addrBits.push(wh.name);
    }
    const addrParts = [
        v.default_to_address_line1,
        v.default_to_address_line2,
        v.default_to_township,
        v.default_to_city,
        v.default_to_region,
        v.default_to_postal_code,
    ].filter((x) => x != null && String(x).trim() !== '');
    if (addrParts.length) {
        addrBits.push(addrParts.join(', '));
    }
    const address = addrBits.length ? addrBits.join(' · ') : '—';

    const full = [recipient !== '—' ? recipient : null, address !== '—' ? address : null].filter(Boolean).join(' — ') || '—';
    return { recipient, address, full };
}

function groupStatusLabel(rows) {
    if (rows?.some?.((r) => r?.status === 'PENDING_ACTION')) {
        return 'PENDING';
    }
    if (rows?.some?.((r) => r?.status === 'INCOMING')) {
        return 'INCOMING';
    }
    return 'COMPLETED';
}

function groupStatusColor(status) {
    if (status === 'PENDING') return 'warning';
    if (status === 'INCOMING') return 'info';
    return 'success';
}

function paymentStatusColor(status) {
    if (status === 'PAID') return 'success';
    if (status === 'WAIVED') return 'default';
    if (status === 'PARTIAL') return 'warning';
    return 'error';
}

export default function WarehouseFulfillmentInbox() {
    const t = useT();
    const {
        instructions = [],
        warehouses = [],
        flash = {},
        admin_app_url: adminAppUrl,
        errors = {},
        fulfillment_warehouse_filter: fulfillmentWarehouseFilter = 'all',
        fulfillment_status_filter: fulfillmentStatusFilter = 'pending',
        fulfillment_page: fulfillmentPage = 'inbox',
        fulfillment_base_path: fulfillmentBasePath = '/operations/fulfillment/inbox',
        fulfillment_fixed_status: fulfillmentFixedStatus = false,
    } = usePage().props;
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
    const [dialog, setDialog] = useState(null);
    const [expanded, setExpanded] = useState(() => ({}));
    const [paymentDialog, setPaymentDialog] = useState(null);

    const form = useForm({
        action_type: 'OWNER_PICKUP',
        next_warehouse_id: '',
        note: '',
    });

    const paymentForm = useForm({
        amount: '',
        currency: 'MMK',
        payment_method: 'CASH',
        paid_at: '',
        reference_no: '',
        note: '',
    });

    const voucherGroups = useMemo(() => {
        const m = new Map();
        for (const row of instructions) {
            const whId = Number(row.warehouse_id ?? row.warehouse?.id ?? 0);
            const voucher = row.voucher_item?.voucher;
            const voucherId = Number(voucher?.id ?? 0);
            if (!whId || !voucherId) continue;

            const key = `${whId}:${voucherId}`;
            if (!m.has(key)) {
                const ship = buildShippingInfo(voucher);
                m.set(key, {
                    key,
                    warehouse_id: whId,
                    warehouse: row.warehouse ?? null,
                    voucher_id: voucherId,
                    voucher_no: voucher?.voucher_no ?? '—',
                    payment_status: voucher?.payment_status ?? 'UNPAID',
                    voucher_total_amount: row?.voucher_total_amount ?? voucher?.total_amount ?? null,
                    voucher_remaining_amount: row?.voucher_remaining_amount ?? null,
                    merchant_name: row.merchant?.name ?? '—',
                    trip: row.trip_item?.trip ?? null,
                    trip_ids: new Set(),
                    rows: [],
                    shipping: ship,
                    remaining_total: 0,
                    line_count: 0,
                });
            }
            const g = m.get(key);
            g.rows.push(row);
            if (row?.trip_item?.trip?.id != null) {
                g.trip_ids.add(Number(row.trip_item.trip.id));
                if (!g.trip) {
                    g.trip = row.trip_item.trip;
                }
            }
            const rem = remainingQty(row);
            g.remaining_total += rem;
            g.line_count += 1;
        }
        const out = Array.from(m.values());
        out.sort((a, b) => {
            const wa = a.warehouse?.code ?? '';
            const wb = b.warehouse?.code ?? '';
            if (wa !== wb) return wa.localeCompare(wb);
            return String(b.voucher_no).localeCompare(String(a.voucher_no));
        });
        return out;
    }, [instructions]);

    const isIncomingPage = fulfillmentPage === 'incoming';

    const openDialog = (group) => {
        const hasPending = Boolean(group?.rows?.some?.((r) => r?.status === 'PENDING_ACTION'));
        if (!hasPending) return;
        form.setData({
            action_type: 'OWNER_PICKUP',
            next_warehouse_id: '',
            note: '',
        });
        form.clearErrors();
        setDialog(group);
    };

    const toDatetimeLocalValue = (d) => {
        if (!d || isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const openPaymentDialog = (group) => {
        paymentForm.setData({
            amount: '',
            currency: 'MMK',
            payment_method: 'CASH',
            paid_at: toDatetimeLocalValue(new Date()),
            reference_no: '',
            note: '',
        });
        paymentForm.clearErrors();
        setPaymentDialog(group);
    };

    const submitPayment = (e) => {
        e.preventDefault();
        if (!paymentDialog?.voucher_id) return;
        paymentForm.post(`${adminAppUrl}/operations/fulfillment/vouchers/${paymentDialog.voucher_id}/payments`, {
            preserveScroll: true,
            onSuccess: () => setPaymentDialog(null),
        });
    };

    const waivePayment = () => {
        if (!paymentDialog?.voucher_id) return;
        router.post(
            `${adminAppUrl}/operations/fulfillment/vouchers/${paymentDialog.voucher_id}/payment-waive`,
            { waived: true },
            { preserveScroll: true, onSuccess: () => setPaymentDialog(null) },
        );
    };

    const allWarehouses = useMemo(() => {
        if (warehouses?.length) {
            return warehouses;
        }
        const map = new Map();
        instructions.forEach((r) => {
            if (r.warehouse) map.set(r.warehouse.id, r.warehouse);
            if (r.next_warehouse) map.set(r.next_warehouse.id, r.next_warehouse);
        });
        return Array.from(map.values());
    }, [instructions, warehouses]);

    const pageHref = `${adminAppUrl}${fulfillmentBasePath}`;
    const title = fulfillmentPage === 'incoming' ? 'Fulfillment Incoming' : 'Warehouse Fulfillment Inbox';
    const subtitle =
        fulfillmentPage === 'incoming'
            ? 'Goods loaded onto trips and in transit to destination warehouses. Not actionable until received.'
            : 'Goods already received at destination warehouses. Process owner pickup, direct delivery, or forward to another warehouse.';
    const counts = useMemo(() => {
        let pending = 0;
        let incoming = 0;
        let completed = 0;
        let paymentAttention = 0;
        for (const g of voucherGroups) {
            const status = groupStatusLabel(g.rows);
            if (status === 'PENDING') pending += 1;
            else if (status === 'INCOMING') incoming += 1;
            else completed += 1;

            if (!isIncomingPage && g.payment_status !== 'PAID' && g.payment_status !== 'WAIVED') {
                paymentAttention += 1;
            }
        }
        return { pending, incoming, completed, paymentAttention };
    }, [isIncomingPage, voucherGroups]);
    const selectedWarehouse = warehouses.find((w) => String(w.id) === String(fulfillmentWarehouseFilter));
    const hasActiveFilters = fulfillmentWarehouseFilter !== 'all' || (!fulfillmentFixedStatus && fulfillmentStatusFilter !== 'pending');
    const summaryCards = [
        { label: 'Visible vouchers', value: voucherGroups.length, helper: `${instructions.length} fulfillment lines`, tone: 'primary.main' },
        { label: 'Pending', value: counts.pending, helper: 'Ready for next action', tone: counts.pending > 0 ? 'warning.main' : 'text.primary' },
        { label: 'Incoming', value: counts.incoming, helper: 'Still in transit', tone: counts.incoming > 0 ? 'info.main' : 'text.primary' },
        {
            label: isIncomingPage ? 'Completed' : 'Payment attention',
            value: isIncomingPage ? counts.completed : counts.paymentAttention,
            helper: isIncomingPage ? 'Already closed' : 'Voucher payments not settled',
            tone: isIncomingPage ? 'success.main' : counts.paymentAttention > 0 ? 'error.main' : 'success.main',
        },
    ];
    const statusPresets = fulfillmentFixedStatus
        ? []
        : [
              { key: 'pending', label: 'Pending', active: fulfillmentStatusFilter === 'pending' },
              { key: 'incoming', label: 'Incoming', active: fulfillmentStatusFilter === 'incoming' },
              { key: 'completed', label: 'Completed', active: fulfillmentStatusFilter === 'completed' },
              { key: 'all', label: 'All', active: fulfillmentStatusFilter === 'all' },
          ];
    const goToFilters = (warehouseId, status) => {
        router.get(pageHref, { warehouse_id: warehouseId, status }, { preserveScroll: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title={title} />
            <Stack spacing={2.5}>
                {flash.success ? <Alert severity="success">{flash.success}</Alert> : null}
                <PageHeader title={title} subtitle={subtitle}>
                    <Stack spacing={1.5}>
                        <Grid container spacing={1.5}>
                            {summaryCards.map((item) => (
                                <Grid key={item.label} item xs={6} md={3}>
                                    <Paper variant="outlined" sx={{ ...SECTION_CARD_SX, p: 1.5, height: '100%' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {item.label}
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900, color: item.tone }}>
                                            {item.value}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                                            {item.helper}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        {!fulfillmentFixedStatus ? (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {statusPresets.map((preset) => (
                                    <Chip
                                        key={preset.key}
                                        label={preset.label}
                                        color={preset.active ? 'primary' : 'default'}
                                        variant={preset.active ? 'filled' : 'outlined'}
                                        onClick={() => goToFilters(fulfillmentWarehouseFilter, preset.key)}
                                    />
                                ))}
                            </Stack>
                        ) : null}

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            <FormControl size="small" sx={{ width: { xs: '100%', sm: 300 } }}>
                                <InputLabel id="fulfillment-wh-filter">Warehouse</InputLabel>
                                <Select
                                    labelId="fulfillment-wh-filter"
                                    label="Warehouse"
                                    value={fulfillmentWarehouseFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        goToFilters(v, fulfillmentStatusFilter);
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.code} · {w.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {!fulfillmentFixedStatus ? (
                                <FormControl size="small" sx={{ width: { xs: '100%', sm: 240 } }}>
                                    <InputLabel id="fulfillment-status-filter">Status</InputLabel>
                                    <Select
                                        labelId="fulfillment-status-filter"
                                        label="Status"
                                        value={fulfillmentStatusFilter}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            goToFilters(fulfillmentWarehouseFilter, v);
                                        }}
                                    >
                                        <MenuItem value="incoming">Incoming</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="completed">Completed</MenuItem>
                                        <MenuItem value="all">All</MenuItem>
                                    </Select>
                                </FormControl>
                            ) : null}
                            {hasActiveFilters ? (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => goToFilters('all', fulfillmentFixedStatus ? fulfillmentStatusFilter : 'pending')}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </Stack>

                        {hasActiveFilters ? (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {selectedWarehouse ? (
                                    <Chip
                                        label={`Warehouse: ${selectedWarehouse.display_name ?? `${selectedWarehouse.code} · ${selectedWarehouse.name}`}`}
                                        onDelete={() => goToFilters('all', fulfillmentStatusFilter)}
                                    />
                                ) : null}
                                {!fulfillmentFixedStatus && fulfillmentStatusFilter !== 'pending' ? (
                                    <Chip label={`Status: ${fulfillmentStatusFilter}`} onDelete={() => goToFilters(fulfillmentWarehouseFilter, 'pending')} />
                                ) : null}
                            </Stack>
                        ) : null}
                    </Stack>
                    {instructions.length === 0 ? (
                        <Paper variant="outlined" sx={{ ...SECTION_CARD_SX, p: 3, textAlign: 'center' }}>
                            <Stack spacing={1.5} alignItems="center">
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    No fulfillment vouchers match this view
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {fulfillmentStatusFilter === 'incoming'
                                        ? 'No incoming (in-transit) lines.'
                                        : fulfillmentStatusFilter === 'completed'
                                        ? 'No completed fulfillment instructions.'
                                        : fulfillmentStatusFilter === 'all'
                                          ? 'No fulfillment instructions.'
                                          : 'No pending fulfillment instructions.'}
                                </Typography>
                                {hasActiveFilters ? (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => goToFilters('all', fulfillmentFixedStatus ? fulfillmentStatusFilter : 'pending')}
                                    >
                                        Clear filters
                                    </Button>
                                ) : null}
                            </Stack>
                        </Paper>
                    ) : (
                        isMdUp ? (
                            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', ...SECTION_CARD_SX }}>
                                <Table size="small" sx={{ minWidth: 800 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: 100, whiteSpace: 'nowrap' }}>Warehouse</TableCell>
                                        <TableCell>Voucher</TableCell>
                                        <TableCell sx={{ minWidth: 200 }}>Shipping address</TableCell>
                                        <TableCell sx={{ width: 80, whiteSpace: 'nowrap' }}>Payment</TableCell>
                                        <TableCell align="right" sx={{ width: 140 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {voucherGroups.map((g) => {
                                        const isOpen = Boolean(expanded[g.key]);
                                        const statusLabel = groupStatusLabel(g.rows);
                                        const isPending = statusLabel === 'PENDING';
                                        return (
                                            <Fragment key={g.key}>
                                                <TableRow hover sx={{ bgcolor: isPending ? 'warning.50' : 'inherit' }}>
                                                <TableCell sx={{ width: 160, whiteSpace: 'nowrap' }}>
                                                    <Typography variant="body2" noWrap title={g.warehouse?.display_name ?? undefined}>
                                                        {g.warehouse ? `${g.warehouse.display_name}` : '—'}
                                                    </Typography>
                                                </TableCell>
                                                    <TableCell sx={{ minWidth: 0 }}>
                                                        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                            <IconButton
                                                                size="small"
                                                                disableRipple
                                                                onClick={() => setExpanded((p) => ({ ...p, [g.key]: !Boolean(p[g.key]) }))}
                                                                aria-label={isOpen ? 'Collapse lines' : 'Expand lines'}
                                                                sx={{
                                                                    mt: 0.1,
                                                                    width: 28,
                                                                    height: 28,
                                                                    flex: '0 0 28px',
                                                                    borderRadius: 1,
                                                                    '&:hover': { bgcolor: 'action.hover' },
                                                                }}
                                                            >
                                                                {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                            </IconButton>
                                                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={g.merchant_name}>
                                                                    {g.merchant_name}
                                                                </Typography>
                                                                <Typography variant="body2" noWrap title={g.voucher_no !== '—' ? g.voucher_no : undefined}>
                                                                    <Link href={`${adminAppUrl}/operations/vouchers/${g.voucher_id}`}>{g.voucher_no}</Link>
                                                                </Typography>
                                                                {g.trip?.id ? (
                                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                                        <Link href={`${adminAppUrl}/operations/trips/${g.trip.id}`}>{g.trip.trip_no ?? 'Trip'}</Link>
                                                                    </Typography>
                                                                ) : null}
                                                                <Box sx={{ pt: 0.25 }}>
                                                                    <Chip
                                                                        size="small"
                                                                        label={statusLabel}
                                                                        variant="outlined"
                                                                        color={groupStatusColor(statusLabel)}
                                                                    />
                                                                </Box>
                                                            </Stack>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 260, maxWidth: 420 }}>
                                                        <Stack spacing={0.1} sx={{ minWidth: 0 }}>
                                                            {g.shipping?.recipient && g.shipping.recipient !== '—' ? (
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        maxWidth: 420,
                                                                    }}
                                                                    title={g.shipping.full !== '—' ? g.shipping.full : undefined}
                                                                >
                                                                    {g.shipping.recipient}
                                                                </Typography>
                                                            ) : null}
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                    display: 'block',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    maxWidth: 420,
                                                                }}
                                                                title={g.shipping.full !== '—' ? g.shipping.full : undefined}
                                                            >
                                                                {g.shipping?.address ?? '—'}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell sx={{ width: 96, whiteSpace: 'nowrap' }}>
                                                        <Chip size="small" label={voucherPaymentStatusLabel(g.payment_status, t)} variant="outlined" color={paymentStatusColor(g.payment_status)} />
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ width: 140 }}>
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            {isIncomingPage ? (
                                                                (() => {
                                                                    const tripHref =
                                                                        g.trip_ids?.size === 1 && g.trip?.id
                                                                            ? `${adminAppUrl}/operations/trips/${g.trip.id}`
                                                                            : `${adminAppUrl}/operations/trips`;
                                                                    return (
                                                                        <Button size="small" variant="outlined" component={Link} href={tripHref}>
                                                                            Confirm delivery
                                                                        </Button>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <>
                                                                    {g.payment_status !== 'PAID' && g.payment_status !== 'WAIVED' ? (
                                                                        <Button size="small" variant="outlined" color="secondary" onClick={() => openPaymentDialog(g)}>
                                                                            Payment
                                                                        </Button>
                                                                    ) : null}
                                                                    {g.rows.some((r) => r?.status === 'PENDING_ACTION') ? (
                                                                        <Button size="small" variant="outlined" onClick={() => openDialog(g)}>
                                                                            Proceed
                                                                        </Button>
                                                                    ) : null}
                                                                </>
                                                            )}
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell colSpan={5} sx={{ py: 0, borderBottom: isOpen ? undefined : 0 }}>
                                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                            <Box sx={{ py: 1.25, pl: 5, pr: 1 }}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                                    Lines: {g.line_count} · Total qty: {formatInt(g.remaining_total)}
                                                                </Typography>
                                                                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                                                    {g.rows.map((r, idx) => {
                                                                        const lineLabel = r.voucher_item?.line_no ? `L${r.voucher_item.line_no}` : `#${idx + 1}`;
                                                                        const productName = r.voucher_item?.product?.name ?? '—';
                                                                        const unit = r.voucher_item?.product?.unit ?? r.voucher_item?.unit ?? '';
                                                                        const rem = remainingQty(r);
                                                                        return (
                                                                            <Fragment key={r.id}>
                                                                                <Grid container columnSpacing={2} rowSpacing={0.75} alignItems="center">
                                                                                    <Grid item xs={2.2}>
                                                                                        <Chip size="small" label={lineLabel} variant="outlined" />
                                                                                    </Grid>
                                                                                    <Grid item xs={6.8} sx={{ minWidth: 0 }}>
                                                                                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={productName !== '—' ? productName : undefined}>
                                                                                            {productName}
                                                                                        </Typography>
                                                                                    </Grid>
                                                                                    <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                                                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                                                            {formatInt(rem)}
                                                                                            {unit ? ` ${unit}` : ''}
                                                                                        </Typography>
                                                                                    </Grid>
                                                                                </Grid>
                                                                                {idx !== g.rows.length - 1 ? <Divider /> : null}
                                                                            </Fragment>
                                                                        );
                                                                    })}
                                                                </Stack>
                                                            </Box>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Stack spacing={1.25}>
                                {voucherGroups.map((g) => {
                                    const statusLabel = groupStatusLabel(g.rows);
                                    const isPending = statusLabel === 'PENDING';
                                    return (
                                    <Paper key={g.key} variant="outlined" sx={{ ...SECTION_CARD_SX, p: 1.5, bgcolor: isPending ? 'warning.50' : 'background.paper' }}>
                                        <Stack spacing={1}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                                    <IconButton
                                                        size="small"
                                                        disableRipple
                                                        onClick={() => setExpanded((p) => ({ ...p, [g.key]: !Boolean(p[g.key]) }))}
                                                        aria-label={expanded[g.key] ? 'Collapse lines' : 'Expand lines'}
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            flex: '0 0 28px',
                                                            borderRadius: 1,
                                                            '&:hover': { bgcolor: 'action.hover' },
                                                        }}
                                                    >
                                                        {expanded[g.key] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                    </IconButton>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, minWidth: 0 }} noWrap title={g.merchant_name}>
                                                        {g.merchant_name}
                                                    </Typography>
                                                </Stack>
                                                <Chip size="small" label={voucherPaymentStatusLabel(g.payment_status, t)} variant="outlined" color={paymentStatusColor(g.payment_status)} />
                                            </Stack>
                                            <Box>
                                                <Chip
                                                    size="small"
                                                    label={statusLabel}
                                                    variant="outlined"
                                                    color={groupStatusColor(statusLabel)}
                                                />
                                            </Box>
                                            <Typography variant="body2" color="text.secondary">
                                                {g.warehouse ? `${g.warehouse.display_name}` : '—'}
                                            </Typography>
                                            <Typography variant="body2">
                                                <Link href={`${adminAppUrl}/operations/vouchers/${g.voucher_id}`}>{g.voucher_no}</Link>
                                            </Typography>
                                            {g.shipping?.recipient && g.shipping.recipient !== '—' ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                    {g.shipping.recipient}
                                                </Typography>
                                            ) : null}
                                            {g.shipping?.address && g.shipping.address !== '—' ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                    {g.shipping.address}
                                                </Typography>
                                            ) : null}
                                            {g.trip?.id ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    Trip:{' '}
                                                    <Link href={`${adminAppUrl}/operations/trips/${g.trip.id}`}>{g.trip.trip_no ?? 'Trip'}</Link>
                                                </Typography>
                                            ) : null}
                                            <Typography variant="body2" color="text.secondary">
                                                Lines: {g.line_count} · Total qty: {formatInt(g.remaining_total)}
                                            </Typography>
                                            <Collapse in={Boolean(expanded[g.key])} timeout="auto" unmountOnExit>
                                                <Divider sx={{ my: 0.5 }} />
                                                <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                                                    {g.rows.map((r, idx) => {
                                                        const lineLabel = r.voucher_item?.line_no ? `L${r.voucher_item.line_no}` : `#${idx + 1}`;
                                                        const productName = r.voucher_item?.product?.name ?? '—';
                                                        const unit = r.voucher_item?.product?.unit ?? r.voucher_item?.unit ?? '';
                                                        const rem = remainingQty(r);
                                                        return (
                                                            <Stack key={r.id} direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                                                                <Box sx={{ minWidth: 0 }}>
                                                                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                                                                        <Chip size="small" label={lineLabel} variant="outlined" />
                                                                        <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 0 }} noWrap title={productName !== '—' ? productName : undefined}>
                                                                            {productName}
                                                                        </Typography>
                                                                    </Stack>
                                                                </Box>
                                                                <Typography variant="body2" sx={{ fontWeight: 800, flexShrink: 0 }}>
                                                                    {formatInt(rem)}
                                                                    {unit ? ` ${unit}` : ''}
                                                                </Typography>
                                                            </Stack>
                                                        );
                                                    })}
                                                </Stack>
                                            </Collapse>
                                            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                                {isIncomingPage ? (
                                                    (() => {
                                                        const tripHref =
                                                            g.trip_ids?.size === 1 && g.trip?.id
                                                                ? `${adminAppUrl}/operations/trips/${g.trip.id}`
                                                                : `${adminAppUrl}/operations/trips`;
                                                        return (
                                                            <Button size="small" variant="outlined" component={Link} href={tripHref} fullWidth>
                                                                Confirm delivery
                                                            </Button>
                                                        );
                                                    })()
                                                ) : (
                                                    <>
                                                        {g.payment_status !== 'PAID' && g.payment_status !== 'WAIVED' ? (
                                                            <Button size="small" variant="outlined" color="secondary" fullWidth onClick={() => openPaymentDialog(g)}>
                                                                Payment
                                                            </Button>
                                                        ) : null}
                                                        {g.rows.some((r) => r?.status === 'PENDING_ACTION') ? (
                                                            <Button size="small" variant="outlined" fullWidth onClick={() => openDialog(g)}>
                                                                Proceed
                                                            </Button>
                                                        ) : null}
                                                    </>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                    );
                                })}
                            </Stack>
                        )
                    )}
                </PageHeader>
                <Dialog open={Boolean(dialog)} onClose={() => !form.processing && setDialog(null)} fullWidth maxWidth="sm">
                    <DialogTitle>Process fulfillment</DialogTitle>
                    <DialogContent>
                        {dialog ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Voucher: {dialog.voucher_no} · Lines: {dialog.line_count}
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="wf-action">Action</InputLabel>
                                    <Select
                                        labelId="wf-action"
                                        label="Action"
                                        value={form.data.action_type}
                                        onChange={(e) => form.setData('action_type', e.target.value)}
                                    >
                                        <MenuItem value="OWNER_PICKUP">Owner pickup</MenuItem>
                                        <MenuItem value="DIRECT_DELIVERY">Direct delivery</MenuItem>
                                        <MenuItem value="FORWARD_TO_WAREHOUSE">Forward to warehouse</MenuItem>
                                    </Select>
                                </FormControl>
                                <Box sx={{ overflowX: 'auto' }}>
                                    <Table size="small" sx={{ minWidth: 520 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Line</TableCell>
                                                <TableCell>Product</TableCell>
                                                <TableCell align="right">Qty</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dialog.rows.map((r, idx) => (
                                                <TableRow key={r.id}>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {r.voucher_item?.line_no ? `L${r.voucher_item.line_no}` : `#${idx + 1}`}
                                                    </TableCell>
                                                    <TableCell>{r.voucher_item?.product?.name ?? '—'}</TableCell>
                                                    <TableCell align="right">{formatInt(remainingQty(r))}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                                {form.data.action_type === 'FORWARD_TO_WAREHOUSE' ? (
                                    <FormControl fullWidth size="small" error={Boolean(errors.next_warehouse_id || form.errors.next_warehouse_id)}>
                                        <InputLabel id="wf-next-wh">Next warehouse</InputLabel>
                                        <Select
                                            labelId="wf-next-wh"
                                            label="Next warehouse"
                                            value={form.data.next_warehouse_id}
                                            onChange={(e) => form.setData('next_warehouse_id', e.target.value)}
                                            error={Boolean(errors.next_warehouse_id || form.errors.next_warehouse_id)}
                                        >
                                            {allWarehouses
                                                .filter((w) => Number(w.id) !== Number(dialog.warehouse_id))
                                                .map((w) => (
                                                    <MenuItem key={w.id} value={String(w.id)}>
                                                        {w.code} · {w.name}
                                                    </MenuItem>
                                                ))}
                                        </Select>
                                        {(errors.next_warehouse_id || form.errors.next_warehouse_id) ? (
                                            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                                                {errors.next_warehouse_id || form.errors.next_warehouse_id}
                                            </Typography>
                                        ) : null}
                                    </FormControl>
                                ) : null}
                                <TextField
                                    size="small"
                                    label="Note (optional)"
                                    multiline
                                    minRows={2}
                                    value={form.data.note}
                                    onChange={(e) => form.setData('note', e.target.value)}
                                />
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialog(null)} disabled={form.processing}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            disabled={form.processing || !dialog}
                            onClick={() => {
                                if (!dialog) return;
                                form.post(`${adminAppUrl}/operations/fulfillment/warehouses/${dialog.warehouse_id}/vouchers/${dialog.voucher_id}/dispatch`, {
                                    preserveScroll: true,
                                    onSuccess: () => setDialog(null),
                                });
                            }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={Boolean(paymentDialog)} onClose={() => setPaymentDialog(null)} fullWidth maxWidth="sm">
                    <form onSubmit={submitPayment}>
                        <DialogTitle>Record payment</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2.5} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Voucher: {paymentDialog?.voucher_no}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total amount: {formatMoneyAmount(paymentDialog?.voucher_total_amount)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Remaining: {formatMoneyAmount(paymentDialog?.voucher_remaining_amount)}
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Amount"
                                            size="small"
                                            fullWidth
                                            type="number"
                                            inputProps={{ step: '1', min: '1' }}
                                            value={paymentForm.data.amount}
                                            onChange={(e) => paymentForm.setData('amount', e.target.value)}
                                            error={Boolean(paymentForm.errors.amount)}
                                            helperText={paymentForm.errors.amount}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small" error={Boolean(paymentForm.errors.payment_method)}>
                                            <InputLabel id="pay-method-label">Method</InputLabel>
                                            <Select
                                                labelId="pay-method-label"
                                                label="Method"
                                                value={paymentForm.data.payment_method}
                                                onChange={(e) => paymentForm.setData('payment_method', e.target.value)}
                                            >
                                                <MenuItem value="CASH">Cash</MenuItem>
                                                <MenuItem value="TRANSFER">Bank Transfer</MenuItem>
                                                <MenuItem value="OTHER">Other</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Paid at"
                                            type="datetime-local"
                                            size="small"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            value={paymentForm.data.paid_at}
                                            onChange={(e) => paymentForm.setData('paid_at', e.target.value)}
                                            error={Boolean(paymentForm.errors.paid_at)}
                                            helperText={paymentForm.errors.paid_at}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            label="Reference No"
                                            size="small"
                                            fullWidth
                                            value={paymentForm.data.reference_no}
                                            onChange={(e) => paymentForm.setData('reference_no', e.target.value)}
                                            error={Boolean(paymentForm.errors.reference_no)}
                                            helperText={paymentForm.errors.reference_no}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Note"
                                            size="small"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            value={paymentForm.data.note}
                                            onChange={(e) => paymentForm.setData('note', e.target.value)}
                                            error={Boolean(paymentForm.errors.note)}
                                            helperText={paymentForm.errors.note}
                                        />
                                    </Grid>
                                </Grid>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, pt: 0 }}>
                            {paymentDialog?.payment_status === 'UNPAID' ? (
                                <Button onClick={waivePayment} color="warning" disabled={paymentForm.processing}>
                                    Waive
                                </Button>
                            ) : null}
                            <Button onClick={() => setPaymentDialog(null)} color="inherit">
                                Cancel
                            </Button>
                            <Button type="submit" variant="contained" disabled={paymentForm.processing}>
                                Save
                            </Button>
                        </DialogActions>
                    </form>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
