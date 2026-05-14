import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
    AddCircleOutlineOutlined as AddCircleOutlineIcon,
    ArrowBack as ArrowBackIcon,
    ArrowDownward as ArrowDownwardIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArticleOutlined as ArticleOutlinedIcon,
    DeleteOutlineOutlined as DeleteOutlineIcon,
    EditOutlined as EditIcon,
    FlightTakeoff as FlightTakeoffIcon,
    LocalShippingOutlined as LocalShippingIcon,
    MoreVert as MoreVertIcon,
    Undo as UndoIcon,
    ExpandLessOutlined as ExpandLessIcon,
    ExpandMoreOutlined as ExpandMoreIcon,
} from '@mui/icons-material';
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
    FormHelperText,
    IconButton,
    InputLabel,
    ListItemIcon,
    Menu,
    MenuItem,
    Paper,
    Select,
    Stack,
    Grid,
    Step,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';

const TRIP_STATUS_COLOR = {
    PLANNED: 'default',
    LOADING: 'info',
    DEPARTED: 'primary',
    AT_STOP: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

const STOP_STATUS_COLOR = {
    PENDING: 'default',
    ARRIVED: 'info',
    COMPLETED: 'success',
    SKIPPED: 'warning',
};

const TRIP_ITEM_STATUS_COLOR = {
    LOADED: 'info',
    IN_TRANSIT: 'primary',
    PARTIALLY_DELIVERED: 'warning',
    DELIVERED: 'success',
    RETURNED: 'error',
};

function tripProgressActiveStep(status) {
    if (status === 'COMPLETED') {
        return 2;
    }
    if (status === 'DEPARTED' || status === 'AT_STOP') {
        return 1;
    }
    return 0;
}

function formatTripDateTime(iso) {
    if (!iso) {
        return null;
    }
    try {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

function formatFixed(value, digits) {
    if (value == null || value === '') {
        return '—';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '—';
    }
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

function formatInt(value) {
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

/** One-line label for the closed Select; full detail in menu + native tooltip */
function voucherLineFieldLabel(row) {
    return `${row.voucher_no} · L${row.line_no} · ${row.product_name}`;
}

function voucherLineDetailTitle(row) {
    return `${row.voucher_no} · line ${row.line_no} · ${row.product_name} — max ${row.remaining_qty} ${row.unit}`;
}

function planStopsFromTrip(stops) {
    return (stops || []).map((s) => ({
        id: s.id,
        clientKey: `e-${s.id}`,
        warehouse_id: s.warehouse_id != null ? String(s.warehouse_id) : '',
        location_name: s.location_name ?? '',
        city: s.city ?? '',
        address: s.address ?? '',
    }));
}

function newEmptyPlanStop() {
    return {
        id: null,
        clientKey: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        warehouse_id: '',
        location_name: '',
        city: '',
        address: '',
    };
}

/** Max loaded qty allowed for this trip item row (same voucher line across non-cancelled trips). */
function maxLoadedQtyForTripItem(tripItem, allItems) {
    const vi = tripItem.voucher_item;
    const qty = Number(vi?.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
        return 1e12;
    }
    const viId = vi.id;
    let elsewhere = 0;
    for (const t of allItems) {
        if (Number(t.id) === Number(tripItem.id)) {
            continue;
        }
        const tvi = t.voucher_item;
        if (tvi && Number(tvi.id) === viId) {
            elsewhere += Number(t.loaded_qty);
        }
    }
    return Math.max(0, qty - elsewhere);
}

function remainingDeliverQty(row) {
    const loaded = Number(row.loaded_qty ?? 0);
    const delivered = Number(row.delivered_qty ?? 0);
    return Math.max(0, loaded - delivered);
}

function hasPendingDestinationReceipt(row) {
    const pending = Number(row?.pending_receipt_qty ?? 0);
    return Number.isFinite(pending) && pending > 0.0001 && row?.voucher_item?.to_warehouse;
}

function formatVoucherDestination(vi) {
    if (!vi) {
        return '—';
    }
    const v = vi.voucher;
    if (!v) {
        return '—';
    }
    const bits = [];
    if (v.default_recipient_name) {
        bits.push(v.default_recipient_name);
    }
    if (v.default_recipient_phone) {
        bits.push(v.default_recipient_phone);
    }
    const wh = v.default_to_warehouse;
    if (wh && (wh.code || wh.name)) {
        bits.push([wh.code, wh.name].filter(Boolean).join(' · '));
    }
    const addrParts = [v.default_to_address_line1, v.default_to_address_line2, v.default_to_township, v.default_to_city, v.default_to_region, v.default_to_postal_code].filter(
        (x) => x != null && String(x).trim() !== '',
    );
    if (addrParts.length) {
        bits.push(addrParts.join(', '));
    }
    return bits.length ? bits.join(' · ') : '—';
}

export default function TripDetail() {
    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
    const pageProps = usePage().props;
    const trip = pageProps.trip;
    const adminAppUrl = pageProps.admin_app_url;
    const flash = pageProps.flash ?? {};
    const errors = pageProps.errors ?? {};
    const canManageCargo = pageProps.can_manage_cargo ?? false;
    /** Load / edit / remove cargo lines while trip is active (includes departed / at stop). */
    const canLoadCargo = pageProps.can_load_cargo ?? pageProps.can_manage_cargo ?? false;
    const canRecordDelivery = pageProps.can_record_delivery ?? false;
    const canMarkDeparted = pageProps.can_mark_departed ?? false;
    const canUndoDepart = pageProps.can_undo_depart ?? false;
    const loadableVouchers = pageProps.loadable_vouchers ?? [];
    const warehouses = pageProps.warehouses ?? [];
    const tripTotalWeight = pageProps.trip_total_weight;
    const tripLaborCost = pageProps.trip_labor_cost;

    const loadForm = useForm({
        voucher_id: '',
        trip_stop_id: '',
    });

    const loadableById = useMemo(() => {
        const m = new Map();
        (loadableVouchers || []).forEach((r) => m.set(r.id, r));
        return m;
    }, [loadableVouchers]);

    const pendingDeliveryRows = useMemo(
        () => (trip?.items || []).filter((row) => remainingDeliverQty(row) > 0.0001),
        [trip?.items],
    );
    const hasPendingDelivery = pendingDeliveryRows.length > 0;

    const loadedCargoSummary = useMemo(() => {
        const items = trip?.items || [];
        let linesWithCargo = 0;
        let totalLoaded = 0;
        for (const row of items) {
            const l = Number(row.loaded_qty ?? 0);
            if (l > 0.0001) {
                linesWithCargo += 1;
            }
            totalLoaded += l;
        }
        return { linesWithCargo, totalLoaded };
    }, [trip?.items]);

    const [planStops, setPlanStops] = useState(() => planStopsFromTrip(trip?.stops));
    const [stopsSaving, setStopsSaving] = useState(false);
    const [itemDialog, setItemDialog] = useState(null);
    const [itemDialogSaving, setItemDialogSaving] = useState(false);
    const [tripDeliveryOpen, setTripDeliveryOpen] = useState(false);
    const [tripDeliveryNote, setTripDeliveryNote] = useState('');
    const [tripDeliverySaving, setTripDeliverySaving] = useState(false);
    const [departDialogOpen, setDepartDialogOpen] = useState(false);
    const [undoDepartDialogOpen, setUndoDepartDialogOpen] = useState(false);
    const [statusActionSaving, setStatusActionSaving] = useState(false);
    const [itemRowMenu, setItemRowMenu] = useState(null);
    const [itemDeliveryDialog, setItemDeliveryDialog] = useState(null);
    const [itemDeliverySaving, setItemDeliverySaving] = useState(false);
    const [voucherRowMenu, setVoucherRowMenu] = useState(null);
    const [voucherStopDialog, setVoucherStopDialog] = useState(null);
    const [voucherExpanded, setVoucherExpanded] = useState(() => ({}));

    const showCargoActionsColumn = canLoadCargo || canRecordDelivery;

    const voucherCargoRows = useMemo(() => {
        const eps = 0.0001;
        const m = new Map();

        for (const row of trip?.items || []) {
            const vi = row?.voucher_item;
            const v = vi?.voucher;
            if (!v?.id) {
                continue;
            }

            const voucherId = Number(v.id);
            if (!m.has(voucherId)) {
                m.set(voucherId, {
                    voucher_id: voucherId,
                    voucher_no: v.voucher_no ?? '—',
                    merchant_name: v.merchant?.name ?? '',
                    destination: formatVoucherDestination(vi),
                    lines: 0,
                    loaded_sum: 0,
                    delivered_sum: 0,
                    stop_ids: new Set(),
                    line_rows: [],
                });
            }

            const agg = m.get(voucherId);
            agg.lines += 1;
            agg.loaded_sum += Number(row?.loaded_qty ?? 0);
            agg.delivered_sum += Number(row?.delivered_qty ?? 0);
            agg.stop_ids.add(row?.trip_stop?.id ?? null);
            agg.line_rows.push({
                id: row?.id,
                line_no: vi?.line_no ?? null,
                product_name: vi?.product?.name ?? '—',
                unit: vi?.product?.unit ?? vi?.unit ?? '',
                loaded_qty: Number(row?.loaded_qty ?? 0),
                delivered_qty: Number(row?.delivered_qty ?? 0),
                status: row?.status ?? 'LOADED',
                stop: row?.trip_stop?.stop_order != null ? `Stop ${row.trip_stop.stop_order}` : '—',
            });
        }

        const out = Array.from(m.values()).map((r) => {
            const remaining = Math.max(0, r.loaded_sum - r.delivered_sum);
            let status = 'LOADED';
            if (remaining <= eps) {
                status = 'DELIVERED';
            } else if (r.delivered_sum > eps) {
                status = 'PARTIALLY_DELIVERED';
            }

            let stop = { mode: 'NONE', id: null, label: '—' };
            if (r.stop_ids.size === 1) {
                const only = Array.from(r.stop_ids)[0];
                if (only != null) {
                    const s = (trip?.stops || []).find((x) => Number(x.id) === Number(only));
                    stop = {
                        mode: 'SINGLE',
                        id: Number(only),
                        label: s?.stop_order != null ? `Stop ${s.stop_order}` : `Stop ${only}`,
                    };
                }
            } else if (r.stop_ids.size > 1) {
                stop = { mode: 'MIXED', id: null, label: 'Mixed' };
            }

            r.line_rows.sort((a, b) => Number(a.line_no ?? 0) - Number(b.line_no ?? 0));

            return {
                ...r,
                remaining_sum: remaining,
                status,
                stop,
            };
        });

        out.sort((a, b) => String(b.voucher_no).localeCompare(String(a.voucher_no)));
        return out;
    }, [trip?.items, trip?.stops]);

    const stopsServerSig = useMemo(
        () =>
            JSON.stringify(
                (trip?.stops || []).map((s) => [s.id, s.stop_order, s.warehouse_id, s.location_name, s.city, s.address]),
            ),
        [trip?.stops],
    );

    useEffect(() => {
        if (!canManageCargo) {
            return;
        }
        setPlanStops(planStopsFromTrip(trip?.stops));
    }, [canManageCargo, stopsServerSig, trip?.id]);

    const stopsSyncError = useMemo(() => {
        if (typeof errors.stops === 'string') {
            return errors.stops;
        }
        const keys = Object.keys(errors).filter((k) => k.startsWith('stops.'));
        for (const k of keys) {
            const v = errors[k];
            if (typeof v === 'string') {
                return v;
            }
            if (Array.isArray(v) && v[0]) {
                return v[0];
            }
        }
        return null;
    }, [errors]);

    const updatePlanStop = useCallback((index, patch) => {
        setPlanStops((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    }, []);

    const addPlanStop = useCallback(() => {
        setPlanStops((prev) => [...prev, newEmptyPlanStop()]);
    }, []);

    const removePlanStop = useCallback((index) => {
        setPlanStops((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    }, []);

    const movePlanStop = useCallback((index, dir) => {
        setPlanStops((prev) => {
            const j = index + dir;
            if (j < 0 || j >= prev.length) {
                return prev;
            }
            const next = [...prev];
            [next[index], next[j]] = [next[j], next[index]];
            return next;
        });
    }, []);

    const submitPlanStops = useCallback(() => {
        setStopsSaving(true);
        router.put(
            `${adminAppUrl}/operations/trips/${trip.id}/stops`,
            {
                stops: planStops.map((s) => ({
                    ...(s.id != null && s.id !== '' ? { id: Number(s.id) } : {}),
                    warehouse_id: s.warehouse_id ? Number(s.warehouse_id) : null,
                    location_name: s.location_name?.trim() || null,
                    city: s.city?.trim() || null,
                    address: s.address?.trim() || null,
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => setStopsSaving(false),
            },
        );
    }, [adminAppUrl, trip?.id, planStops]);

    const openEditItem = useCallback((row) => {
        setItemDialog({
            row,
            loaded_qty: String(row.loaded_qty),
            trip_stop_id: row.trip_stop?.id != null ? String(row.trip_stop.id) : '',
        });
    }, []);

    const saveItemDialog = useCallback(() => {
        if (!itemDialog?.row) {
            return;
        }
        setItemDialogSaving(true);
        router.patch(
            `${adminAppUrl}/operations/trips/${trip.id}/items/${itemDialog.row.id}`,
            {
                loaded_qty: Number(itemDialog.loaded_qty),
                trip_stop_id: itemDialog.trip_stop_id === '' ? null : Number(itemDialog.trip_stop_id),
            },
            {
                preserveScroll: true,
                onSuccess: () => setItemDialog(null),
                onFinish: () => setItemDialogSaving(false),
            },
        );
    }, [adminAppUrl, trip?.id, itemDialog]);

    const removeTripItem = useCallback(
        (row) => {
            if (!window.confirm('Remove this cargo line from the trip?')) {
                return;
            }
            router.delete(`${adminAppUrl}/operations/trips/${trip.id}/items/${row.id}`, { preserveScroll: true });
        },
        [adminAppUrl, trip?.id],
    );

    const receiveAtDestinationWarehouse = useCallback(
        (row) => {
            const pending = Number(row?.pending_receipt_qty ?? 0);
            const unit = row?.voucher_item?.product?.unit ?? row?.voucher_item?.unit ?? '';
            const wh = row?.voucher_item?.to_warehouse;
            const target = wh ? [wh.code, wh.name].filter(Boolean).join(' · ') : 'destination warehouse';
            if (!window.confirm(`Receive ${formatInt(pending)}${unit ? ` ${unit}` : ''} into ${target}?`)) {
                return;
            }
            router.post(
                `${adminAppUrl}/operations/trips/${trip.id}/items/${row.id}/destination-receipts`,
                {},
                { preserveScroll: true },
            );
        },
        [adminAppUrl, trip?.id],
    );

    const openTripDeliveryDialog = useCallback(() => {
        setTripDeliveryNote('');
        setTripDeliveryOpen(true);
    }, []);

    const saveTripDeliveryDialog = useCallback(() => {
        setTripDeliverySaving(true);
        router.post(
            `${adminAppUrl}/operations/trips/${trip.id}/delivery-confirmations`,
            { note: tripDeliveryNote.trim() || null },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTripDeliveryOpen(false);
                    setTripDeliveryNote('');
                },
                onFinish: () => setTripDeliverySaving(false),
            },
        );
    }, [adminAppUrl, trip?.id, tripDeliveryNote]);

    const rowHasCargoActions = useCallback(
        (row) => canLoadCargo || (canRecordDelivery && remainingDeliverQty(row) > 0.0001) || (canRecordDelivery && hasPendingDestinationReceipt(row)),
        [canLoadCargo, canRecordDelivery],
    );

    const openItemDeliveryDialog = useCallback((row) => {
        const rem = remainingDeliverQty(row);
        setItemDeliveryDialog({
            row,
            delivery_status: 'FULL',
            received_qty: rem.toFixed(3),
            note: '',
        });
    }, []);

    const saveItemDeliveryDialog = useCallback(() => {
        if (!itemDeliveryDialog?.row) {
            return;
        }
        const row = itemDeliveryDialog.row;
        const status = itemDeliveryDialog.delivery_status;
        let qty = Number(itemDeliveryDialog.received_qty);
        if (status === 'REJECTED') {
            qty = 0;
        }
        setItemDeliverySaving(true);
        router.post(
            `${adminAppUrl}/operations/trips/${trip.id}/items/${row.id}/delivery-confirmations`,
            {
                received_qty: qty,
                delivery_status: status,
                note: itemDeliveryDialog.note?.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => setItemDeliveryDialog(null),
                onFinish: () => setItemDeliverySaving(false),
            },
        );
    }, [adminAppUrl, trip?.id, itemDeliveryDialog]);

    const submitLoad = (e) => {
        e.preventDefault();
        loadForm.post(`${adminAppUrl}/operations/trips/${trip.id}/vouchers/load`, {
            preserveScroll: true,
            onSuccess: () => loadForm.reset(),
        });
    };

    const submitMarkDeparted = useCallback(() => {
        setStatusActionSaving(true);
        router.patch(
            `${adminAppUrl}/operations/trips/${trip.id}/status`,
            { target_status: 'DEPARTED' },
            {
                preserveScroll: true,
                onSuccess: () => setDepartDialogOpen(false),
                onFinish: () => setStatusActionSaving(false),
            },
        );
    }, [adminAppUrl, trip?.id]);

    const submitUndoDepart = useCallback(() => {
        setStatusActionSaving(true);
        router.patch(
            `${adminAppUrl}/operations/trips/${trip.id}/status`,
            { target_status: 'PLANNED' },
            {
                preserveScroll: true,
                onSuccess: () => setUndoDepartDialogOpen(false),
                onFinish: () => setStatusActionSaving(false),
            },
        );
    }, [adminAppUrl, trip?.id]);

    if (!trip) {
        return (
            <AdminLayout title="Trip">
                <Head title="Trip" />
                <Typography variant="body2" color="text.secondary">
                    Not found.
                </Typography>
            </AdminLayout>
        );
    }

    const layoutTitle = trip.trip_no ?? 'Trip';

    return (
        <AdminLayout title={layoutTitle}>
            <Head title={layoutTitle} />
            <Stack spacing={2.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {errors.target_status ? (
                    <Alert severity="error">
                        {Array.isArray(errors.target_status) ? errors.target_status[0] : errors.target_status}
                    </Alert>
                ) : null}
                <Button
                    component={Link}
                    href={`${adminAppUrl}/operations/trips`}
                    startIcon={<ArrowBackIcon />}
                    variant="text"
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Back to trips
                </Button>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                            <Stack spacing={0.5} sx={{ flex: '1 1 auto', minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, flex: '1 1 auto', minWidth: 0, fontSize: { xs: '1.05rem', sm: undefined } }}>
                                    {trip.trip_no}
                                </Typography>
                            </Stack>
                            <Chip
                                size="small"
                                label={trip.status}
                                color={TRIP_STATUS_COLOR[trip.status] ?? 'default'}
                                variant="outlined"
                            />
                            <Button
                                component="a"
                                href={`${adminAppUrl}/operations/trips/${trip.id}/manifest`}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="outlined"
                                size="small"
                                startIcon={<ArticleOutlinedIcon />}
                                sx={{
                                    flexShrink: 0,
                                    minWidth: { xs: 40, sm: 'auto' },
                                    px: { xs: 1, sm: 1.5 },
                                    '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
                                }}
                            >
                                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                    Driver manifest
                                </Box>
                            </Button>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            Trip summary. Load confirmed voucher lines from the source warehouse in partial quantities; totals
                            cannot exceed each line&apos;s ordered quantity across non-cancelled trips.
                        </Typography>
                        <Divider />
                        <Grid container spacing={2.5}>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Vehicle
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {trip.vehicle ? `${trip.vehicle.vehicle_no} (${trip.vehicle.vehicle_type})` : '—'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Source warehouse
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {trip.source_warehouse?.name ?? '—'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Driver
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {[trip.driver_name, trip.driver_phone].filter(Boolean).join(' · ') || '—'}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Total weight
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripTotalWeight, 3)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Labor cost
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripLaborCost, 2)}
                                </Typography>
                            </Grid>
                            {trip.creator?.name ? (
                                <Grid item xs={12} sm={6} md={4}>
                                    <Typography variant="caption" color="text.secondary">
                                        Created by
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                        {trip.creator.name}
                                    </Typography>
                                </Grid>
                            ) : null}
                        </Grid>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Departure &amp; progress
                    </Typography>
                    {trip.status === 'CANCELLED' ? (
                        <Alert severity="warning">This trip was cancelled.</Alert>
                    ) : (
                        <Stack spacing={2}>
                            <Stepper
                                activeStep={tripProgressActiveStep(trip.status)}
                                orientation={isSmUp ? 'horizontal' : 'vertical'}
                                sx={{
                                    '& .MuiStepLabel-label': { typography: 'caption', fontWeight: 600 },
                                    '& .MuiStepConnector-line': { minHeight: isSmUp ? undefined : 16 },
                                }}
                            >
                                <Step>
                                    <StepLabel>Planned / loading</StepLabel>
                                </Step>
                                <Step>
                                    <StepLabel>Departed</StepLabel>
                                </Step>
                                <Step>
                                    <StepLabel>Completed</StepLabel>
                                </Step>
                            </Stepper>
                            {trip.departed_at ? (
                                <Typography variant="body2" color="text.secondary">
                                    Departed at{' '}
                                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {formatTripDateTime(trip.departed_at)}
                                    </Box>
                                </Typography>
                            ) : null}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                                {canMarkDeparted ? (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<FlightTakeoffIcon />}
                                        onClick={() => setDepartDialogOpen(true)}
                                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                                    >
                                        Mark as departed
                                    </Button>
                                ) : null}
                                {canUndoDepart ? (
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        startIcon={<UndoIcon />}
                                        onClick={() => setUndoDepartDialogOpen(true)}
                                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                                    >
                                        Undo departure
                                    </Button>
                                ) : null}
                            </Stack>
                            {!canMarkDeparted &&
                            !canUndoDepart &&
                            (trip.status === 'PLANNED' || trip.status === 'LOADING') &&
                            loadedCargoSummary.linesWithCargo === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    Load at least one cargo line, then use <strong>Mark as departed</strong> when the vehicle leaves the source warehouse.
                                </Typography>
                            ) : null}
                            {!canMarkDeparted && !canUndoDepart && (trip.status === 'DEPARTED' || trip.status === 'AT_STOP') ? (
                                <Typography variant="body2" color="text.secondary">
                                    Trip is in transit. Record deliveries from the cargo section when drops are confirmed.
                                </Typography>
                            ) : null}
                            {trip.status === 'COMPLETED' ? (
                                <Typography variant="body2" color="text.secondary">
                                    This trip is completed.
                                </Typography>
                            ) : null}
                        </Stack>
                    )}
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Stops
                    </Typography>
                    {canManageCargo ? (
                        <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                                While the trip is planned or loading, you can add, reorder, or remove stops (removal is blocked if cargo is still assigned to that stop). Save
                                when you are done editing.
                            </Typography>
                            {stopsSyncError ? <Alert severity="error">{stopsSyncError}</Alert> : null}
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                spacing={1.5}
                                flexWrap="wrap"
                            >
                                <Button
                                    size="small"
                                    startIcon={<AddCircleOutlineIcon />}
                                    onClick={addPlanStop}
                                    sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
                                >
                                    Add stop
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={stopsSaving}
                                    onClick={submitPlanStops}
                                    sx={{ ml: { sm: 'auto' }, alignSelf: { xs: 'stretch', sm: 'center' } }}
                                >
                                    Save stops
                                </Button>
                            </Stack>
                            <Stack spacing={2}>
                                {planStops.map((stop, index) => {
                                    const serverStop = stop.id != null ? (trip.stops || []).find((x) => Number(x.id) === Number(stop.id)) : null;
                                    return (
                                        <Box key={stop.clientKey}>
                                            {index > 0 && <Divider sx={{ mb: 2 }} />}
                                            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={1}>
                                                <Stack spacing={0.5} sx={{ minWidth: { sm: 72 } }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mt: { sm: 1 } }}>
                                                        Stop {index + 1}
                                                    </Typography>
                                                    {serverStop ? (
                                                        <Chip
                                                            size="small"
                                                            label={serverStop.status}
                                                            color={STOP_STATUS_COLOR[serverStop.status] ?? 'default'}
                                                            variant="outlined"
                                                            sx={{ alignSelf: 'flex-start' }}
                                                        />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">
                                                            New
                                                        </Typography>
                                                    )}
                                                    <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'flex', sm: 'none' }, flexWrap: 'wrap' }}>
                                                        <IconButton size="small" aria-label="Move up" disabled={index === 0} onClick={() => movePlanStop(index, -1)}>
                                                            <ArrowUpwardIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Move down"
                                                            disabled={index >= planStops.length - 1}
                                                            onClick={() => movePlanStop(index, 1)}
                                                        >
                                                            <ArrowDownwardIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Remove stop"
                                                            disabled={planStops.length <= 1}
                                                            onClick={() => removePlanStop(index)}
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                                <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel id={`plan-wh-${stop.clientKey}`}>Warehouse (optional)</InputLabel>
                                                        <Select
                                                            labelId={`plan-wh-${stop.clientKey}`}
                                                            label="Warehouse (optional)"
                                                            value={stop.warehouse_id}
                                                            onChange={(e) => updatePlanStop(index, { warehouse_id: e.target.value })}
                                                        >
                                                            <MenuItem value="">
                                                                <em>—</em>
                                                            </MenuItem>
                                                            {warehouses.map((w) => (
                                                                <MenuItem key={w.id} value={String(w.id)}>
                                                                    {w.code} · {w.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                    <TextField
                                                        label="Location name"
                                                        size="small"
                                                        fullWidth
                                                        value={stop.location_name}
                                                        onChange={(e) => updatePlanStop(index, { location_name: e.target.value })}
                                                        error={Boolean(errors[`stops.${index}`])}
                                                        helperText={errors[`stops.${index}`]}
                                                    />
                                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                        <TextField
                                                            label="City"
                                                            size="small"
                                                            fullWidth
                                                            value={stop.city}
                                                            onChange={(e) => updatePlanStop(index, { city: e.target.value })}
                                                        />
                                                        <TextField
                                                            label="Address"
                                                            size="small"
                                                            fullWidth
                                                            value={stop.address}
                                                            onChange={(e) => updatePlanStop(index, { address: e.target.value })}
                                                            multiline
                                                            minRows={2}
                                                        />
                                                    </Stack>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Provide a warehouse <strong>or</strong> location / city / address for this stop.
                                                    </Typography>
                                                </Stack>
                                                <Stack direction="column" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' }, mt: 0.5 }}>
                                                    <IconButton size="small" aria-label="Move up" disabled={index === 0} onClick={() => movePlanStop(index, -1)}>
                                                        <ArrowUpwardIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Move down"
                                                        disabled={index >= planStops.length - 1}
                                                        onClick={() => movePlanStop(index, 1)}
                                                    >
                                                        <ArrowDownwardIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Remove stop"
                                                        disabled={planStops.length <= 1}
                                                        onClick={() => removePlanStop(index)}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    ) : isSmUp ? (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 480 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell width={56}>#</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Warehouse</TableCell>
                                        <TableCell>Location</TableCell>
                                        <TableCell>City</TableCell>
                                        <TableCell sx={{ minWidth: 180 }}>Address</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(trip.stops || []).map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell>{s.stop_order}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={s.status}
                                                    color={STOP_STATUS_COLOR[s.status] ?? 'default'}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{s.warehouse ? `${s.warehouse.code}` : '—'}</TableCell>
                                            <TableCell>{s.location_name ?? '—'}</TableCell>
                                            <TableCell>{s.city ?? '—'}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.address ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {(trip.stops || []).length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No stops.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    ) : (
                        <Stack spacing={1.5}>
                            {(trip.stops || []).map((s) => (
                                <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack spacing={1}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                Stop {s.stop_order}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={s.status}
                                                color={STOP_STATUS_COLOR[s.status] ?? 'default'}
                                                variant="outlined"
                                            />
                                        </Stack>
                                        <Divider />
                                        <Typography variant="body2" color="text.secondary">
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                Warehouse
                                            </Box>{' '}
                                            · {s.warehouse ? s.warehouse.code : '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                Location
                                            </Box>{' '}
                                            · {s.location_name ?? '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                City
                                            </Box>{' '}
                                            · {s.city ?? '—'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            <Box component="span" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Address
                                            </Box>
                                            <br />
                                            {s.address ?? '—'}
                                        </Typography>
                                    </Stack>
                                </Paper>
                            ))}
                            {(trip.stops || []).length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    No stops.
                                </Typography>
                            )}
                        </Stack>
                    )}
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: '1 1 auto', minWidth: 0 }}>
                            Cargo (trip items)
                        </Typography>
                        {canRecordDelivery && hasPendingDelivery ? (
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<LocalShippingIcon />}
                                onClick={openTripDeliveryDialog}
                                sx={{ flexShrink: 0, whiteSpace: { xs: 'normal', sm: 'nowrap' }, alignSelf: { xs: 'stretch', sm: 'auto' } }}
                                fullWidth={!isSmUp}
                            >
                                Confirm trip delivery
                            </Button>
                        ) : null}
                    </Stack>
                    {canRecordDelivery ? (
                        <Alert severity="info" sx={{ mb: 1.5 }}>
                            Destination and recipient come from each voucher (shown below). Use one <strong>Confirm trip delivery</strong> action to record the full remaining
                            quantity on every cargo line at once. For vouchers with a destination warehouse, stock is received there and then processed from the
                            Warehouse Fulfillment Inbox (owner pickup/direct delivery/forward).
                        </Alert>
                    ) : null}

                    {canLoadCargo && (
                        <Box component="form" onSubmit={submitLoad} sx={{ mb: 2.5 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }} flexWrap="wrap">
                                <FormControl sx={{ minWidth: { xs: '100%', sm: 280 }, maxWidth: '100%' }} size="small" error={Boolean(loadForm.errors.voucher_id)}>
                                    {/* shrink: required with displayEmpty + renderValue so notch + label stay in sync (MUI) */}
                                    <InputLabel id="load-line-label" shrink>
                                        Voucher
                                    </InputLabel>
                                    <Select
                                        labelId="load-line-label"
                                        label="Voucher"
                                        displayEmpty
                                        value={loadForm.data.voucher_id === '' ? '' : String(loadForm.data.voucher_id)}
                                        onChange={(ev) =>
                                            loadForm.setData('voucher_id', ev.target.value === '' ? '' : Number(ev.target.value))
                                        }
                                        renderValue={(selected) => {
                                            if (selected === '') {
                                                return (
                                                    <Typography component="span" variant="body2" color="text.secondary">
                                                        Select…
                                                    </Typography>
                                                );
                                            }
                                            const row = loadableById.get(Number(selected));
                                            if (!row) {
                                                return selected;
                                            }
                                            const primary = row.merchant_name || row.voucher_no;
                                            const secondary = row.merchant_name ? row.voucher_no : '';
                                            return (
                                                <Box component="span" sx={{ display: 'block', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                                                    <Typography
                                                        component="span"
                                                        variant="body2"
                                                        title={secondary ? `${primary} · ${secondary}` : primary}
                                                        sx={{
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            width: '100%',
                                                            maxWidth: '100%',
                                                            textAlign: 'left',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {primary}
                                                    </Typography>
                                                    {secondary ? (
                                                        <Typography
                                                            component="span"
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{
                                                                display: 'block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                width: '100%',
                                                                maxWidth: '100%',
                                                            }}
                                                        >
                                                            {secondary}
                                                        </Typography>
                                                    ) : null}
                                                </Box>
                                            );
                                        }}
                                        MenuProps={{
                                            PaperProps: {
                                                sx: {
                                                    maxWidth: 'min(100vw - 24px, 420px)',
                                                },
                                            },
                                        }}
                                    >
                                        <MenuItem value="">
                                            <Typography component="span" variant="body2" color="text.secondary">
                                                Select…
                                            </Typography>
                                        </MenuItem>
                                        {(loadableVouchers || []).map((row) => (
                                            <MenuItem
                                                key={row.id}
                                                value={String(row.id)}
                                                sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1 }}
                                            >
                                                <Stack spacing={0.35} sx={{ width: '100%', minWidth: 0 }}>
                                                    <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ width: '100%', minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3, minWidth: 0, flex: '1 1 auto' }} noWrap>
                                                            {row.merchant_name || '—'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                                            {row.voucher_no}
                                                        </Typography>
                                                    </Stack>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Loads all remaining lines ({row.lines})
                                                    </Typography>
                                                </Stack>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {loadForm.errors.voucher_id ? (
                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                                            {loadForm.errors.voucher_id}
                                        </Typography>
                                    ) : null}
                                </FormControl>
                                <FormControl sx={{ minWidth: { xs: '100%', sm: 200 }, maxWidth: '100%' }} size="small" error={Boolean(loadForm.errors.trip_stop_id)}>
                                    <InputLabel id="load-stop-label" shrink>
                                        Drop stop (optional)
                                    </InputLabel>
                                    <Select
                                        labelId="load-stop-label"
                                        label="Drop stop (optional)"
                                        displayEmpty
                                        value={loadForm.data.trip_stop_id === '' ? '' : String(loadForm.data.trip_stop_id)}
                                        onChange={(ev) =>
                                            loadForm.setData('trip_stop_id', ev.target.value === '' ? '' : Number(ev.target.value))
                                        }
                                        renderValue={(selected) => {
                                            if (selected === '') {
                                                return (
                                                    <Typography component="span" variant="body2" color="text.secondary">
                                                        Not set
                                                    </Typography>
                                                );
                                            }
                                            const s = (trip.stops || []).find((st) => String(st.id) === String(selected));
                                            if (!s) {
                                                return selected;
                                            }
                                            const parts = [s.warehouse?.code, s.location_name, s.city].filter(Boolean);
                                            const secondary = parts.join(' · ');
                                            const title = `Stop ${s.stop_order}${secondary ? ` — ${secondary}` : ''}${s.address ? ` — ${s.address}` : ''}`;
                                            const oneLine = `Stop ${s.stop_order}${secondary ? ` · ${secondary}` : ''}`;
                                            return (
                                                <Box
                                                    component="span"
                                                    title={title}
                                                    sx={{
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        width: '100%',
                                                        maxWidth: '100%',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    {oneLine}
                                                </Box>
                                            );
                                        }}
                                        MenuProps={{
                                            PaperProps: {
                                                sx: {
                                                    maxWidth: 'min(100vw - 24px, 360px)',
                                                },
                                            },
                                        }}
                                    >
                                        <MenuItem value="">
                                            <Typography component="span" variant="body2" color="text.secondary">
                                                Not set
                                            </Typography>
                                        </MenuItem>
                                        {(trip.stops || []).map((s) => {
                                            const parts = [s.warehouse?.code, s.location_name, s.city].filter(Boolean);
                                            const line2 = parts.join(' · ');
                                            return (
                                                <MenuItem key={s.id} value={String(s.id)} sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1 }}>
                                                    <Stack spacing={0.35} sx={{ width: '100%', minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                            Stop {s.stop_order}
                                                        </Typography>
                                                        {line2 ? (
                                                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word', lineHeight: 1.35 }}>
                                                                {line2}
                                                            </Typography>
                                                        ) : null}
                                                        {s.address ? (
                                                            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                                {s.address}
                                                            </Typography>
                                                        ) : null}
                                                    </Stack>
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                    {loadForm.errors.trip_stop_id ? (
                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                                            {loadForm.errors.trip_stop_id}
                                        </Typography>
                                    ) : null}
                                </FormControl>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={loadForm.processing}
                                    sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', sm: 'auto' } }}
                                >
                                    Add to trip
                                </Button>
                            </Stack>
                            {(loadableVouchers || []).length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                    No vouchers available: need confirmed vouchers with remaining quantity from this trip&apos;s source warehouse.
                                </Typography>
                            ) : null}
                        </Box>
                    )}

                    {(trip.items || []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            Nothing loaded yet.
                        </Typography>
                    ) : isSmUp ? (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: showCargoActionsColumn || canManageCargo ? 760 : 520 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell sx={{ width: 520 }}>Voucher</TableCell>
                                        <TableCell sx={{ width: 120 }}>Stop</TableCell>
                                        <TableCell width={64} align="right">
                                            Lines
                                        </TableCell>
                                        <TableCell sx={{ width: 140 }}>Status</TableCell>
                                        {showCargoActionsColumn ? <TableCell align="right" width={56} /> : null}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {voucherCargoRows.map((row) => {
                                        const merchantName = row.merchant_name || '';
                                        const voucherNo = row.voucher_no ?? '—';
                                        const dest = row.destination ?? '—';
                                        const isOpen = Boolean(voucherExpanded[row.voucher_id]);
                                        return (
                                            <Fragment key={row.voucher_id}>
                                                <TableRow hover>
                                                    <TableCell sx={{ py: 0.75, minWidth: 0 }}>
                                                        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                            <IconButton
                                                                size="small"
                                                                disableRipple
                                                                onClick={() =>
                                                                    setVoucherExpanded((p) => ({ ...p, [row.voucher_id]: !Boolean(p[row.voucher_id]) }))
                                                                }
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
                                                            <Stack spacing={0.35} sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                                                <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                                                                    <Typography
                                                                        variant="body2"
                                                                        sx={{
                                                                            fontWeight: 800,
                                                                            lineHeight: 1.2,
                                                                            minWidth: 0,
                                                                        }}
                                                                        noWrap
                                                                        title={merchantName || undefined}
                                                                    >
                                                                        {merchantName || '—'}
                                                                    </Typography>
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                        sx={{ flexShrink: 0 }}
                                                                        title={voucherNo !== '—' ? voucherNo : undefined}
                                                                    >
                                                                        {voucherNo}
                                                                    </Typography>
                                                                </Stack>
                                                                {dest !== '—' ? (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                        sx={{
                                                                            display: 'block',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            whiteSpace: 'nowrap',
                                                                            minWidth: 0,
                                                                        }}
                                                                        title={dest}
                                                                    >
                                                                        {dest}
                                                                    </Typography>
                                                                ) : null}
                                                            </Stack>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.stop?.label && row.stop.label !== '—' ? (
                                                            <Chip size="small" label={row.stop.label} variant="outlined" sx={{ height: 20 }} />
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">{row.lines}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={row.status}
                                                            color={TRIP_ITEM_STATUS_COLOR[row.status] ?? 'default'}
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    {showCargoActionsColumn ? (
                                                        <TableCell align="right">
                                                            <IconButton
                                                                size="small"
                                                                aria-label="Voucher cargo actions"
                                                                onClick={(e) => setVoucherRowMenu({ anchorEl: e.currentTarget, row })}
                                                            >
                                                                <MoreVertIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    ) : null}
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell colSpan={showCargoActionsColumn ? 5 : 4} sx={{ py: 0, borderBottom: isOpen ? undefined : 0 }}>
                                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                            <Box sx={{ py: 1.25, pl: 5, pr: 1 }}>
                                                                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                                                    {row.line_rows.map((ln, idx) => (
                                                                        <Fragment key={ln.id}>
                                                                            <Grid container columnSpacing={2} rowSpacing={0.75} alignItems="center">
                                                                                <Grid item xs={1.5}>
                                                                                    <Chip size="small" label={ln.line_no != null ? `L${ln.line_no}` : '—'} variant="outlined" />
                                                                                </Grid>
                                                                                <Grid item xs={7.5} sx={{ minWidth: 0 }}>
                                                                                    <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={ln.product_name !== '—' ? ln.product_name : undefined}>
                                                                                        {ln.product_name}
                                                                                    </Typography>
                                                                                </Grid>
                                                                                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                                                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                                                        {formatInt(ln.loaded_qty)}
                                                                                        {ln.unit ? ` ${ln.unit}` : ''}
                                                                                    </Typography>
                                                                                </Grid>
                                                                            </Grid>
                                                                            {idx !== row.line_rows.length - 1 ? <Divider /> : null}
                                                                        </Fragment>
                                                                    ))}
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
                        </Box>
                    ) : (
                        <Stack spacing={1.5}>
                            {voucherCargoRows.map((row) => {
                                const dest = row.destination ?? '—';
                                const isOpen = Boolean(voucherExpanded[row.voucher_id]);
                                return (
                                    <Paper key={row.voucher_id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                        <Stack spacing={1.25}>
                                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>
                                                    {row.merchant_name || '—'}
                                                </Typography>
                                                <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                                                    <Chip
                                                        size="small"
                                                        label={row.status}
                                                        color={TRIP_ITEM_STATUS_COLOR[row.status] ?? 'default'}
                                                        variant="outlined"
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        disableRipple
                                                        aria-label={isOpen ? 'Collapse lines' : 'Expand lines'}
                                                        onClick={() =>
                                                            setVoucherExpanded((p) => ({ ...p, [row.voucher_id]: !Boolean(p[row.voucher_id]) }))
                                                        }
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            flex: '0 0 28px',
                                                            borderRadius: 1,
                                                            '&:hover': { bgcolor: 'action.hover' },
                                                        }}
                                                    >
                                                        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                    </IconButton>
                                                    {showCargoActionsColumn ? (
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Voucher cargo actions"
                                                            onClick={(e) => setVoucherRowMenu({ anchorEl: e.currentTarget, row })}
                                                        >
                                                            <MoreVertIcon fontSize="small" />
                                                        </IconButton>
                                                    ) : null}
                                                </Stack>
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary">
                                                {row.voucher_no ?? '—'} · {row.lines} line{row.lines === 1 ? '' : 's'}
                                            </Typography>
                                            {dest !== '—' ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word', lineHeight: 1.45 }}>
                                                    {dest}
                                                </Typography>
                                            ) : null}
                                            {row.stop?.label && row.stop.label !== '—' ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        Stop
                                                    </Box>{' '}
                                                    · {row.stop.label}
                                                </Typography>
                                            ) : null}
                                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                <Divider sx={{ my: 0.5 }} />
                                                <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                                                    {row.line_rows.map((ln) => (
                                                        <Stack key={ln.id} direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                                                                    <Chip size="small" label={ln.line_no != null ? `L${ln.line_no}` : '—'} variant="outlined" />
                                                                    <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 0 }} noWrap title={ln.product_name !== '—' ? ln.product_name : undefined}>
                                                                        {ln.product_name}
                                                                    </Typography>
                                                                </Stack>
                                                            </Box>
                                                            <Typography variant="body2" sx={{ fontWeight: 800, flexShrink: 0 }}>
                                                                {formatInt(ln.loaded_qty)}
                                                                {ln.unit ? ` ${ln.unit}` : ''}
                                                            </Typography>
                                                        </Stack>
                                                    ))}
                                                </Stack>
                                            </Collapse>
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    )}
                </Paper>

                <Menu
                    open={Boolean(voucherRowMenu?.anchorEl)}
                    anchorEl={voucherRowMenu?.anchorEl || null}
                    onClose={() => setVoucherRowMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        disabled={!canRecordDelivery || !(voucherRowMenu?.row?.remaining_sum > 0.0001)}
                        onClick={() => {
                            const r = voucherRowMenu?.row;
                            setVoucherRowMenu(null);
                            if (!r) return;
                            if (!window.confirm(`Confirm delivery for voucher ${r.voucher_no}?`)) return;
                            router.post(
                                `${adminAppUrl}/operations/trips/${trip.id}/vouchers/${r.voucher_id}/delivery-confirmations`,
                                { note: null },
                                { preserveScroll: true },
                            );
                        }}
                    >
                        Confirm delivery
                    </MenuItem>
                    <MenuItem
                        disabled={!canLoadCargo}
                        onClick={() => {
                            const r = voucherRowMenu?.row;
                            setVoucherRowMenu(null);
                            if (!r) return;
                            setVoucherStopDialog({
                                row: r,
                                trip_stop_id: r.stop.mode === 'SINGLE' && r.stop.id != null ? String(r.stop.id) : '',
                            });
                        }}
                    >
                        Edit stop
                    </MenuItem>
                    <MenuItem
                        disabled={!canLoadCargo}
                        onClick={() => {
                            const r = voucherRowMenu?.row;
                            setVoucherRowMenu(null);
                            if (!r) return;
                            if (!window.confirm(`Remove voucher ${r.voucher_no} from the trip?`)) return;
                            router.delete(`${adminAppUrl}/operations/trips/${trip.id}/vouchers/${r.voucher_id}`, { preserveScroll: true });
                        }}
                    >
                        Remove from trip
                    </MenuItem>
                </Menu>

                <Dialog open={Boolean(voucherStopDialog)} onClose={() => setVoucherStopDialog(null)} fullWidth maxWidth="xs">
                    <DialogTitle>Edit voucher stop</DialogTitle>
                    <DialogContent>
                        {voucherStopDialog?.row ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {voucherStopDialog.row.voucher_no}
                                    {voucherStopDialog.row.merchant_name ? ` · ${voucherStopDialog.row.merchant_name}` : ''}
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="voucher-stop-label">Drop stop</InputLabel>
                                    <Select
                                        labelId="voucher-stop-label"
                                        label="Drop stop"
                                        value={voucherStopDialog.trip_stop_id}
                                        onChange={(e) => setVoucherStopDialog((p) => ({ ...p, trip_stop_id: e.target.value }))}
                                    >
                                        <MenuItem value="">
                                            <Typography variant="body2" color="text.secondary">
                                                Not set
                                            </Typography>
                                        </MenuItem>
                                        {(trip.stops || []).map((s) => (
                                            <MenuItem key={s.id} value={String(s.id)}>
                                                Stop {s.stop_order}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {voucherStopDialog.row.stop.mode === 'MIXED' ? (
                                    <Typography variant="caption" color="text.secondary">
                                        Current stop is mixed across lines. Saving will set one stop for all lines.
                                    </Typography>
                                ) : null}
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setVoucherStopDialog(null)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                const r = voucherStopDialog?.row;
                                if (!r) return;
                                const val = voucherStopDialog.trip_stop_id;
                                router.patch(
                                    `${adminAppUrl}/operations/trips/${trip.id}/vouchers/${r.voucher_id}/stop`,
                                    { trip_stop_id: val === '' ? null : Number(val) },
                                    { preserveScroll: true, onSuccess: () => setVoucherStopDialog(null) },
                                );
                            }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={Boolean(itemDialog)} onClose={() => !itemDialogSaving && setItemDialog(null)} fullWidth maxWidth="xs">
                    <DialogTitle>Edit cargo</DialogTitle>
                    <DialogContent>
                        {itemDialog?.row ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {itemDialog.row.voucher_item?.voucher?.voucher_no ?? '—'} · line {itemDialog.row.voucher_item?.line_no ?? '—'} ·{' '}
                                    {itemDialog.row.voucher_item?.product?.name ?? '—'}
                                </Typography>
                                <TextField
                                    size="small"
                                    label="Loaded quantity"
                                    type="number"
                                    required
                                    inputProps={{
                                        step: '0.001',
                                        min: '0.001',
                                        max: maxLoadedQtyForTripItem(itemDialog.row, trip.items || []),
                                    }}
                                    value={itemDialog.loaded_qty}
                                    onChange={(e) => setItemDialog((d) => (d ? { ...d, loaded_qty: e.target.value } : d))}
                                    error={Boolean(errors.loaded_qty)}
                                    helperText={
                                        (typeof errors.loaded_qty === 'string'
                                            ? errors.loaded_qty
                                            : errors.loaded_qty?.[0]) ||
                                        `Max for this line on this trip: ${formatInt(maxLoadedQtyForTripItem(itemDialog.row, trip.items || []))} ${itemDialog.row.voucher_item?.product?.unit ?? itemDialog.row.voucher_item?.unit ?? ''}`
                                    }
                                />
                                <FormControl fullWidth size="small" error={Boolean(errors.trip_stop_id)}>
                                    <InputLabel id="edit-item-stop" shrink>
                                        Drop stop
                                    </InputLabel>
                                    <Select
                                        labelId="edit-item-stop"
                                        label="Drop stop"
                                        displayEmpty
                                        value={itemDialog.trip_stop_id}
                                        onChange={(e) => setItemDialog((d) => (d ? { ...d, trip_stop_id: e.target.value } : d))}
                                    >
                                        <MenuItem value="">
                                            <Typography component="span" variant="body2" color="text.secondary">
                                                Not set
                                            </Typography>
                                        </MenuItem>
                                        {(trip.stops || []).map((s) => (
                                            <MenuItem key={s.id} value={String(s.id)}>
                                                Stop {s.stop_order}
                                                {s.warehouse?.code ? ` · ${s.warehouse.code}` : ''}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.trip_stop_id ? <FormHelperText error>{errors.trip_stop_id}</FormHelperText> : null}
                                </FormControl>
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setItemDialog(null)} disabled={itemDialogSaving}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={saveItemDialog} disabled={itemDialogSaving}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>

                <Menu
                    anchorEl={itemRowMenu?.anchorEl}
                    open={Boolean(itemRowMenu)}
                    onClose={() => setItemRowMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {itemRowMenu?.row && canRecordDelivery && remainingDeliverQty(itemRowMenu.row) > 0.0001 ? (
                        <MenuItem
                            onClick={() => {
                                const r = itemRowMenu.row;
                                setItemRowMenu(null);
                                openItemDeliveryDialog(r);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <LocalShippingIcon fontSize="small" />
                            </ListItemIcon>
                            Confirm delivery
                        </MenuItem>
                    ) : null}
                    {itemRowMenu?.row && canRecordDelivery && hasPendingDestinationReceipt(itemRowMenu.row) ? (
                        <MenuItem
                            onClick={() => {
                                const r = itemRowMenu.row;
                                setItemRowMenu(null);
                                receiveAtDestinationWarehouse(r);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <AddCircleOutlineIcon fontSize="small" />
                            </ListItemIcon>
                            Receive at destination warehouse
                        </MenuItem>
                    ) : null}
                    {itemRowMenu?.row && canLoadCargo ? (
                        <MenuItem
                            onClick={() => {
                                const r = itemRowMenu.row;
                                setItemRowMenu(null);
                                openEditItem(r);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <EditIcon fontSize="small" />
                            </ListItemIcon>
                            Edit cargo
                        </MenuItem>
                    ) : null}
                    {itemRowMenu?.row && canLoadCargo ? (
                        <MenuItem
                            onClick={() => {
                                const r = itemRowMenu.row;
                                setItemRowMenu(null);
                                removeTripItem(r);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <DeleteOutlineIcon fontSize="small" />
                            </ListItemIcon>
                            Remove cargo
                        </MenuItem>
                    ) : null}
                </Menu>

                <Dialog open={Boolean(itemDeliveryDialog)} onClose={() => !itemDeliverySaving && setItemDeliveryDialog(null)} fullWidth maxWidth="sm">
                    <DialogTitle>Confirm delivery</DialogTitle>
                    <DialogContent>
                        {itemDeliveryDialog?.row ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {itemDeliveryDialog.row.voucher_item?.voucher?.voucher_no ?? '—'} · line{' '}
                                    {itemDeliveryDialog.row.voucher_item?.line_no ?? '—'} · {itemDeliveryDialog.row.voucher_item?.product?.name ?? '—'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Destination (from voucher):{' '}
                                    <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                        {formatVoucherDestination(itemDeliveryDialog.row.voucher_item)}
                                    </Box>
                                </Typography>
                                <Typography variant="body2">
                                    Remaining on this cargo line:{' '}
                                    <Box component="span" sx={{ fontWeight: 700 }}>
                                        {formatInt(remainingDeliverQty(itemDeliveryDialog.row))}{' '}
                                        {itemDeliveryDialog.row.voucher_item?.product?.unit ?? itemDeliveryDialog.row.voucher_item?.unit ?? ''}
                                    </Box>
                                </Typography>
                                <FormControl fullWidth size="small" error={Boolean(errors.delivery_status)}>
                                    <InputLabel id="item-delivery-status">Receipt type</InputLabel>
                                    <Select
                                        labelId="item-delivery-status"
                                        label="Receipt type"
                                        value={itemDeliveryDialog.delivery_status}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setItemDeliveryDialog((d) => {
                                                if (!d?.row) {
                                                    return d;
                                                }
                                                const rem = remainingDeliverQty(d.row);
                                                let rq = d.received_qty;
                                                if (next === 'FULL') {
                                                    rq = rem.toFixed(3);
                                                } else if (next === 'REJECTED') {
                                                    rq = '0';
                                                } else if (next === 'PARTIAL') {
                                                    const cur = Number(d.received_qty);
                                                    const safe =
                                                        Number.isFinite(cur) && cur > 0 && cur < rem - 0.0001
                                                            ? cur
                                                            : Math.min(rem / 2, rem - 0.001);
                                                    rq = Math.max(0.001, safe).toFixed(3);
                                                }
                                                return { ...d, delivery_status: next, received_qty: rq };
                                            });
                                        }}
                                    >
                                        <MenuItem value="FULL">Full remaining</MenuItem>
                                        <MenuItem value="PARTIAL">Partial</MenuItem>
                                        <MenuItem value="REJECTED">Rejected</MenuItem>
                                    </Select>
                                    {errors.delivery_status ? (
                                        <FormHelperText error>
                                            {typeof errors.delivery_status === 'string'
                                                ? errors.delivery_status
                                                : errors.delivery_status?.[0]}
                                        </FormHelperText>
                                    ) : null}
                                </FormControl>
                                <TextField
                                    size="small"
                                    label="Received quantity"
                                    type="number"
                                    required
                                    disabled={itemDeliveryDialog.delivery_status === 'REJECTED'}
                                    inputProps={{
                                        step: '0.001',
                                        min: '0',
                                        max:
                                            itemDeliveryDialog.delivery_status === 'FULL'
                                                ? remainingDeliverQty(itemDeliveryDialog.row).toFixed(3)
                                                : remainingDeliverQty(itemDeliveryDialog.row).toFixed(3),
                                    }}
                                    value={itemDeliveryDialog.received_qty}
                                    onChange={(e) =>
                                        setItemDeliveryDialog((d) => (d ? { ...d, received_qty: e.target.value } : d))
                                    }
                                    error={Boolean(errors.received_qty)}
                                    helperText={
                                        typeof errors.received_qty === 'string'
                                            ? errors.received_qty
                                            : errors.received_qty?.[0] ||
                                              (itemDeliveryDialog.delivery_status === 'REJECTED'
                                                  ? 'Rejected receipts use quantity 0.'
                                                  : itemDeliveryDialog.delivery_status === 'FULL'
                                                    ? 'Must match full remaining quantity.'
                                                    : 'Must be greater than 0 and less than remaining for partial.')
                                    }
                                />
                                <TextField
                                    size="small"
                                    label="Note (optional)"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={itemDeliveryDialog.note}
                                    onChange={(e) =>
                                        setItemDeliveryDialog((d) => (d ? { ...d, note: e.target.value } : d))
                                    }
                                    error={Boolean(errors.note)}
                                    helperText={
                                        errors.note
                                            ? typeof errors.note === 'string'
                                                ? errors.note
                                                : errors.note?.[0]
                                            : null
                                    }
                                />
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setItemDeliveryDialog(null)} disabled={itemDeliverySaving}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={saveItemDeliveryDialog} disabled={itemDeliverySaving}>
                            Save receipt
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={tripDeliveryOpen}
                    onClose={() => !tripDeliverySaving && setTripDeliveryOpen(false)}
                    fullWidth
                    maxWidth="md"
                >
                    <DialogTitle>Confirm trip delivery</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Records the full remaining quantity for every cargo line below in one step. Recipient and address come from each voucher line (already shown on this page).
                            </Typography>
                            <Box sx={{ overflowX: 'auto', mx: { xs: -1, sm: 0 } }}>
                                <Table size="small" sx={{ minWidth: { xs: 480, sm: 560 } }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                            <TableCell>Product</TableCell>
                                            <TableCell>Voucher · line</TableCell>
                                            <TableCell sx={{ minWidth: 140 }}>Destination</TableCell>
                                            <TableCell align="right">Remaining</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pendingDeliveryRows.map((row) => {
                                            const vi = row.voucher_item;
                                            const unit = vi?.product?.unit ?? vi?.unit ?? '';
                                            const rem = remainingDeliverQty(row);
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                        {vi?.product?.name ?? '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {vi?.voucher?.voucher_no ?? '—'} · L{vi?.line_no ?? '—'}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{
                                                            maxWidth: 280,
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            fontSize: '0.8125rem',
                                                            color: 'text.secondary',
                                                            verticalAlign: 'top',
                                                        }}
                                                    >
                                                        {formatVoucherDestination(vi)}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {formatInt(rem)}
                                                        {unit ? ` ${unit}` : ''}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Box>
                            <TextField
                                size="small"
                                label="Note (optional)"
                                fullWidth
                                multiline
                                minRows={2}
                                value={tripDeliveryNote}
                                onChange={(e) => setTripDeliveryNote(e.target.value)}
                                error={Boolean(errors.note)}
                                helperText={
                                    errors.note
                                        ? typeof errors.note === 'string'
                                            ? errors.note
                                            : errors.note?.[0]
                                        : 'Optional; saved on each receipt in this batch.'
                                }
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setTripDeliveryOpen(false)} disabled={tripDeliverySaving}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={saveTripDeliveryDialog} disabled={tripDeliverySaving}>
                            Confirm all
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={departDialogOpen}
                    onClose={() => !statusActionSaving && setDepartDialogOpen(false)}
                    fullWidth
                    maxWidth="sm"
                >
                    <DialogTitle>Mark trip as departed?</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                Confirms the vehicle has left the source warehouse. Voucher lines on this trip will move to <strong>In transit</strong> when applicable.
                            </Typography>
                            <Typography variant="body2">
                                Cargo lines with load:{' '}
                                <Box component="span" sx={{ fontWeight: 700 }}>
                                    {loadedCargoSummary.linesWithCargo}
                                </Box>
                                <br />
                                Total loaded quantity (sum of lines):{' '}
                                <Box component="span" sx={{ fontWeight: 700 }}>
                                    {formatInt(loadedCargoSummary.totalLoaded)}
                                </Box>
                            </Typography>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
                        <Button onClick={() => setDepartDialogOpen(false)} disabled={statusActionSaving} sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={submitMarkDeparted}
                            disabled={statusActionSaving}
                            startIcon={<FlightTakeoffIcon />}
                            sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
                        >
                            Mark as departed
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={undoDepartDialogOpen}
                    onClose={() => !statusActionSaving && setUndoDepartDialogOpen(false)}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Undo departure?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary">
                            Sets the trip back to <strong>planned</strong> so stops and loading can be adjusted again. Only available before any delivery has been recorded.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
                        <Button onClick={() => setUndoDepartDialogOpen(false)} disabled={statusActionSaving} sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={submitUndoDepart}
                            disabled={statusActionSaving}
                            startIcon={<UndoIcon />}
                            sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
                        >
                            Undo departure
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
