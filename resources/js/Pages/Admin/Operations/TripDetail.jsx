import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
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
    Checkbox,
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
    const rounded = Math.round(n);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded);
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
    /** Load / edit / remove cargo lines while trip is active (includes departed / in transit). */
    const canLoadCargo = pageProps.can_load_cargo ?? pageProps.can_manage_cargo ?? false;
    const canRecordDelivery = pageProps.can_record_delivery ?? false;
    const canManageTripCosts = pageProps.can_manage_trip_costs ?? false;
    const canRecordTripNetIncome = pageProps.can_record_trip_net_income ?? false;
    const tripNetIncomeRecorded = pageProps.trip_net_income_recorded ?? false;
    const canMarkDeparted = pageProps.can_mark_departed ?? false;
    const canUndoDepart = pageProps.can_undo_depart ?? false;
    const loadableVouchers = pageProps.loadable_vouchers ?? [];
    const tripTotalWeight = pageProps.trip_total_weight;
    const tripLaborCost = pageProps.trip_labor_cost;
    const tripCostCategories = pageProps.trip_cost_categories ?? [];
    const tripCostEntries = pageProps.trip_cost_entries ?? [];
    const tripExtraCostTotal = pageProps.trip_extra_cost_total;

    const tripTotalCost = useMemo(() => {
        const labor = Number(tripLaborCost ?? 0);
        const extra = Number(tripExtraCostTotal ?? 0);
        if (!Number.isFinite(labor) && !Number.isFinite(extra)) {
            return null;
        }
        return (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(extra) ? extra : 0);
    }, [tripLaborCost, tripExtraCostTotal]);

    const voucherFinanceSummary = useMemo(() => {
        const byId = new Map();
        for (const item of trip?.items ?? []) {
            const v = item?.voucher_item?.voucher;
            const id = Number(v?.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (byId.has(id)) continue;
            byId.set(id, v);
        }

        let billedTotal = 0;
        let collectedTotal = 0;
        let outstandingTotal = 0;
        let waivedTotal = 0;
        let additionalCostsTotal = 0;
        const statusCounts = { PAID: 0, PARTIAL: 0, UNPAID: 0, WAIVED: 0, OTHER: 0 };

        for (const v of byId.values()) {
            const total = Number(v?.total_amount);
            const billed = Number.isFinite(total) ? total : 0;
            const paid = Number.isFinite(Number(v?.paid_amount)) ? Number(v.paid_amount) : 0;
            const remaining = Math.max(0, billed - paid);
            billedTotal += billed;
            collectedTotal += paid;

            const costs = Array.isArray(v?.additional_costs) ? v.additional_costs : [];
            for (const row of costs) {
                const n = Number(row?.amount);
                if (Number.isFinite(n) && n > 0) additionalCostsTotal += n;
            }

            const status = String(v?.payment_status ?? '').toUpperCase();
            if (status === 'PAID') statusCounts.PAID += 1;
            else if (status === 'PARTIAL') statusCounts.PARTIAL += 1;
            else if (status === 'UNPAID') statusCounts.UNPAID += 1;
            else if (status === 'WAIVED') statusCounts.WAIVED += 1;
            else statusCounts.OTHER += 1;

            if (status === 'WAIVED') waivedTotal += remaining;
            else outstandingTotal += remaining;
        }

        billedTotal = Math.round(billedTotal * 100) / 100;
        collectedTotal = Math.round(collectedTotal * 100) / 100;
        outstandingTotal = Math.round(outstandingTotal * 100) / 100;
        waivedTotal = Math.round(waivedTotal * 100) / 100;
        additionalCostsTotal = Math.round(additionalCostsTotal * 100) / 100;

        return {
            voucherCount: byId.size,
            billedTotal,
            collectedTotal,
            outstandingTotal,
            waivedTotal,
            additionalCostsTotal,
            statusCounts,
        };
    }, [trip?.items]);

    const tripNetIncome = useMemo(() => {
        const payments = Number(voucherFinanceSummary.collectedTotal);
        const voucherCosts = Number(voucherFinanceSummary.additionalCostsTotal);
        const tripCosts = Number(tripExtraCostTotal ?? 0);
        if (!Number.isFinite(payments) && !Number.isFinite(voucherCosts) && !Number.isFinite(tripCosts)) return null;
        return Math.round(((Number.isFinite(payments) ? payments : 0) - (Number.isFinite(voucherCosts) ? voucherCosts : 0) - (Number.isFinite(tripCosts) ? tripCosts : 0)) * 100) / 100;
    }, [tripExtraCostTotal, voucherFinanceSummary.additionalCostsTotal, voucherFinanceSummary.collectedTotal]);

    const [netIncomeDialogOpen, setNetIncomeDialogOpen] = useState(false);
    const [netIncomeDialogProcessing, setNetIncomeDialogProcessing] = useState(false);
    const [netIncomeDialogError, setNetIncomeDialogError] = useState('');

    const openNetIncomeDialog = useCallback(() => {
        if (!canRecordTripNetIncome || tripNetIncomeRecorded) return;
        setNetIncomeDialogError('');
        setNetIncomeDialogOpen(true);
    }, [canRecordTripNetIncome, tripNetIncomeRecorded]);

    const closeNetIncomeDialog = useCallback(() => {
        if (netIncomeDialogProcessing) return;
        setNetIncomeDialogOpen(false);
    }, [netIncomeDialogProcessing]);

    const submitNetIncomeDialog = useCallback(() => {
        if (!canRecordTripNetIncome || tripNetIncomeRecorded) return;
        setNetIncomeDialogError('');
        const n = Number(tripNetIncome);
        if (!Number.isFinite(n) || n <= 0) {
            setNetIncomeDialogError('Net income must be positive.');
            return;
        }
        setNetIncomeDialogProcessing(true);
        router.post(
            `${adminAppUrl}/operations/trips/${trip.id}/net-income-ledger`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setNetIncomeDialogOpen(false),
                onError: () => setNetIncomeDialogError('Failed to add net income to ledger.'),
                onFinish: () => setNetIncomeDialogProcessing(false),
            },
        );
    }, [adminAppUrl, canRecordTripNetIncome, trip?.id, tripNetIncome, tripNetIncomeRecorded]);

    const [tripCostDialogOpen, setTripCostDialogOpen] = useState(false);
    const [tripCostDialogProcessing, setTripCostDialogProcessing] = useState(false);
    const [tripCostDialogError, setTripCostDialogError] = useState('');
    const [tripCostForm, setTripCostForm] = useState({
        id: null,
        category_id: '',
        amount: '',
        note: '',
    });

    const loadableById = useMemo(() => {
        const m = new Map();
        (loadableVouchers || []).forEach((r) => m.set(r.id, r));
        return m;
    }, [loadableVouchers]);

    const vehicleMaxWeight = useMemo(() => {
        const n = Number(trip?.vehicle?.capacity_weight);
        return Number.isFinite(n) && n > 0.0001 ? n : null;
    }, [trip?.vehicle?.capacity_weight]);

    const [selectedVoucherMap, setSelectedVoucherMap] = useState(() => ({}));
    const [loadBatchProcessing, setLoadBatchProcessing] = useState(false);

    useEffect(() => {
        const allowed = new Set((loadableVouchers || []).map((r) => Number(r.id)));
        setSelectedVoucherMap((prev) => {
            const next = {};
            let changed = false;
            for (const [k, v] of Object.entries(prev || {})) {
                const id = Number(k);
                if (!allowed.has(id) || !v) {
                    changed = true;
                    continue;
                }
                next[String(id)] = true;
            }
            return changed ? next : prev;
        });
    }, [loadableVouchers]);

    const selectedVoucherIds = useMemo(
        () => Object.keys(selectedVoucherMap || {}).filter((k) => selectedVoucherMap[k]).map((k) => Number(k)),
        [selectedVoucherMap],
    );

    const selectedWeightSummary = useMemo(() => {
        let knownSum = 0;
        let unknownCount = 0;
        for (const id of selectedVoucherIds) {
            const row = loadableById.get(id);
            const w = row?.total_weight;
            if (w === null || w === undefined) {
                unknownCount += 1;
                continue;
            }
            const n = Number(w);
            if (Number.isFinite(n) && n > 0.0001) {
                knownSum += n;
            }
        }
        knownSum = Math.round(knownSum * 1000) / 1000;
        return { knownSum, unknownCount };
    }, [selectedVoucherIds, loadableById]);

    const allLoadableWeightSummary = useMemo(() => {
        let knownSum = 0;
        let unknownCount = 0;
        for (const row of loadableVouchers || []) {
            const w = row?.total_weight;
            if (w === null || w === undefined) {
                unknownCount += 1;
                continue;
            }
            const n = Number(w);
            if (Number.isFinite(n) && n > 0.0001) {
                knownSum += n;
            }
        }
        knownSum = Math.round(knownSum * 1000) / 1000;
        return { knownSum, unknownCount };
    }, [loadableVouchers]);

    const selectedExceedsVehicleWeight = useMemo(() => {
        if (vehicleMaxWeight === null) return false;
        return selectedWeightSummary.knownSum > vehicleMaxWeight + 0.0001;
    }, [selectedWeightSummary.knownSum, vehicleMaxWeight]);

    const allExceedsVehicleWeight = useMemo(() => {
        if (vehicleMaxWeight === null) return false;
        return allLoadableWeightSummary.knownSum > vehicleMaxWeight + 0.0001;
    }, [allLoadableWeightSummary.knownSum, vehicleMaxWeight]);

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
                    line_rows: [],
                });
            }

            const agg = m.get(voucherId);
            agg.lines += 1;
            agg.loaded_sum += Number(row?.loaded_qty ?? 0);
            agg.delivered_sum += Number(row?.delivered_qty ?? 0);
            agg.line_rows.push({
                id: row?.id,
                line_no: vi?.line_no ?? null,
                product_name: vi?.product?.name ?? '—',
                unit: vi?.product?.unit ?? vi?.unit ?? '',
                loaded_qty: Number(row?.loaded_qty ?? 0),
                delivered_qty: Number(row?.delivered_qty ?? 0),
                status: row?.status ?? 'LOADED',
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

            r.line_rows.sort((a, b) => Number(a.line_no ?? 0) - Number(b.line_no ?? 0));

            return {
                ...r,
                remaining_sum: remaining,
                status,
            };
        });

        out.sort((a, b) => String(b.voucher_no).localeCompare(String(a.voucher_no)));
        return out;
    }, [trip?.items]);

    const openEditItem = useCallback((row) => {
        setItemDialog({
            row,
            loaded_qty: String(row.loaded_qty),
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

    const openCreateTripCost = useCallback(() => {
        if (!canManageTripCosts) return;
        const first = tripCostCategories?.[0];
        setTripCostDialogError('');
        setTripCostForm({
            id: null,
            category_id: first?.id != null ? String(first.id) : '',
            amount: '',
            note: '',
        });
        setTripCostDialogOpen(true);
    }, [canManageTripCosts, tripCostCategories]);

    const openEditTripCost = useCallback(
        (row) => {
            if (!canManageTripCosts) return;
            setTripCostDialogError('');
            setTripCostForm({
                id: row.id,
                category_id: row.category_id != null ? String(row.category_id) : row.category?.id != null ? String(row.category.id) : '',
                amount: row.amount != null ? String(row.amount) : '',
                note: row.note ?? '',
            });
            setTripCostDialogOpen(true);
        },
        [canManageTripCosts],
    );

    const closeTripCostDialog = useCallback(() => {
        if (tripCostDialogProcessing) return;
        setTripCostDialogOpen(false);
    }, [tripCostDialogProcessing]);

    const submitTripCostDialog = useCallback(() => {
        if (!canManageTripCosts) return;
        setTripCostDialogError('');

        const categoryId = tripCostForm.category_id === '' ? null : Number(tripCostForm.category_id);
        const amount = Number(tripCostForm.amount);
        const note = tripCostForm.note?.trim() || null;

        if (!categoryId || !Number.isFinite(categoryId)) {
            setTripCostDialogError('Select a category.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setTripCostDialogError('Enter a valid amount.');
            return;
        }

        const payload = {
            category_id: categoryId,
            amount,
            note,
        };

        setTripCostDialogProcessing(true);
        if (!tripCostForm.id) {
            router.post(`${adminAppUrl}/operations/trips/${trip.id}/cost-entries`, payload, {
                preserveScroll: true,
                onSuccess: () => setTripCostDialogOpen(false),
                onFinish: () => setTripCostDialogProcessing(false),
            });
            return;
        }

        router.patch(`${adminAppUrl}/operations/trips/${trip.id}/cost-entries/${tripCostForm.id}`, payload, {
            preserveScroll: true,
            onSuccess: () => setTripCostDialogOpen(false),
            onFinish: () => setTripCostDialogProcessing(false),
        });
    }, [adminAppUrl, canManageTripCosts, trip?.id, tripCostForm]);

    const removeTripCost = useCallback(
        (row) => {
            if (!canManageTripCosts) return;
            if (!window.confirm('Delete this trip cost entry?')) return;
            router.delete(`${adminAppUrl}/operations/trips/${trip.id}/cost-entries/${row.id}`, { preserveScroll: true });
        },
        [adminAppUrl, canManageTripCosts, trip?.id],
    );

    const rowHasCargoActions = useCallback(
        (row) => canLoadCargo || (canRecordDelivery && remainingDeliverQty(row) > 0.0001) || (canRecordDelivery && hasPendingDestinationReceipt(row)),
        [canLoadCargo, canRecordDelivery],
    );

    const openItemDeliveryDialog = useCallback((row) => {
        const rem = remainingDeliverQty(row);
        setItemDeliveryDialog({
            row,
            delivery_status: 'FULL',
            received_qty: String(Math.round(rem)),
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

    const submitLoadBatch = useCallback(
        (ids) => {
            if (!canLoadCargo || loadBatchProcessing) return;
            const voucherIds = (ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
            if (voucherIds.length === 0) return;

            setLoadBatchProcessing(true);
            router.post(
                `${adminAppUrl}/operations/trips/${trip.id}/vouchers/load-batch`,
                { voucher_ids: voucherIds },
                {
                    preserveScroll: true,
                    onSuccess: () => setSelectedVoucherMap({}),
                    onFinish: () => setLoadBatchProcessing(false),
                },
            );
        },
        [adminAppUrl, canLoadCargo, loadBatchProcessing, trip?.id],
    );

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
                            Trip summary. Load confirmed vouchers for this trip&apos;s destination warehouse; totals cannot exceed each line&apos;s ordered
                            quantity across non-cancelled trips.
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
                                    Destination warehouse
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {trip?.stops?.[0]?.warehouse?.display_name || trip?.source_warehouse?.display_name || '—'}
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
                                    {formatFixed(tripTotalWeight, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Labor cost
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripLaborCost, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Trip extra costs
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripExtraCostTotal, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Total trip cost
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripTotalCost, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Voucher billed
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(voucherFinanceSummary.billedTotal, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Voucher collected
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(voucherFinanceSummary.collectedTotal, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Voucher additional costs
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(voucherFinanceSummary.additionalCostsTotal, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Voucher outstanding
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(voucherFinanceSummary.outstandingTotal, 0)}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                    Net (payments - voucher costs - trip costs)
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                                    {formatFixed(tripNetIncome, 0)}
                                </Typography>
                                {canRecordTripNetIncome ? (
                                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                                        {tripNetIncomeRecorded ? (
                                            <Chip size="small" color="success" variant="outlined" label="Added to ledger" />
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={openNetIncomeDialog}
                                                disabled={!Number.isFinite(Number(tripNetIncome)) || Number(tripNetIncome) <= 0}
                                            >
                                                Add net income to ledger
                                            </Button>
                                        )}
                                    </Stack>
                                ) : null}
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
                        {voucherFinanceSummary.voucherCount > 0 ? (
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                <Chip size="small" variant="outlined" label={`${voucherFinanceSummary.voucherCount} vouchers`} />
                                {voucherFinanceSummary.statusCounts.PAID > 0 ? (
                                    <Chip size="small" color="success" variant="outlined" label={`Paid ${voucherFinanceSummary.statusCounts.PAID}`} />
                                ) : null}
                                {voucherFinanceSummary.statusCounts.PARTIAL > 0 ? (
                                    <Chip size="small" color="warning" variant="outlined" label={`Partial ${voucherFinanceSummary.statusCounts.PARTIAL}`} />
                                ) : null}
                                {voucherFinanceSummary.statusCounts.UNPAID > 0 ? (
                                    <Chip size="small" color="warning" variant="outlined" label={`Unpaid ${voucherFinanceSummary.statusCounts.UNPAID}`} />
                                ) : null}
                                {voucherFinanceSummary.statusCounts.WAIVED > 0 ? (
                                    <Chip size="small" variant="outlined" label={`Waived ${voucherFinanceSummary.statusCounts.WAIVED}`} />
                                ) : null}
                            </Stack>
                        ) : null}
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
                        >
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Trip costs
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Operational costs recorded directly on this trip (does not change vouchers).
                                </Typography>
                            </Box>
                            {canManageTripCosts ? (
                                <Button
                                    variant="contained"
                                    startIcon={<AddCircleOutlineIcon />}
                                    onClick={openCreateTripCost}
                                    disabled={tripCostCategories.length === 0}
                                >
                                    Add cost
                                </Button>
                            ) : null}
                        </Stack>

                        {tripCostCategories.length === 0 ? (
                            <Alert severity="warning">Add at least one Trip Cost Category before recording trip costs.</Alert>
                        ) : null}

                        {tripCostEntries.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No trip costs yet.
                            </Typography>
                        ) : (
                            <Paper sx={{ overflowX: 'auto' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Category</TableCell>
                                            <TableCell align="right">Amount</TableCell>
                                            <TableCell>Note</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {tripCostEntries.map((row) => (
                                            <TableRow key={row.id} hover>
                                                <TableCell>{row.category?.name ?? '—'}</TableCell>
                                                <TableCell align="right">{formatFixed(row.amount, 0)}</TableCell>
                                                <TableCell sx={{ maxWidth: 360 }} title={row.note ?? ''}>
                                                    {row.note || '—'}
                                                </TableCell>
                                                <TableCell align="right" sx={{ width: 104, whiteSpace: 'nowrap' }}>
                                                    {canManageTripCosts ? (
                                                        <Fragment>
                                                            <IconButton size="small" onClick={() => openEditTripCost(row)} aria-label="Edit trip cost">
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => removeTripCost(row)}
                                                                aria-label="Delete trip cost"
                                                                sx={{ color: 'error.main' }}
                                                            >
                                                                <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Fragment>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        )}
                    </Stack>
                </Paper>

                <Dialog open={netIncomeDialogOpen} onClose={closeNetIncomeDialog} fullWidth maxWidth="xs">
                    <DialogTitle>Add net income to Finance Ledger</DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                            {netIncomeDialogError ? <Alert severity="error">{netIncomeDialogError}</Alert> : null}
                            <Typography variant="body2" color="text.secondary">
                                This will create a ledger entry. Duplicate entries are blocked.
                            </Typography>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Amount
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatFixed(tripNetIncome, 0)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Category
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    Trip
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Note
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {trip?.trip_no ?? '—'}
                                </Typography>
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeNetIncomeDialog} disabled={netIncomeDialogProcessing}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={submitNetIncomeDialog} disabled={netIncomeDialogProcessing}>
                            Add
                        </Button>
                    </DialogActions>
                </Dialog>

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
                                    Load at least one cargo line, then use <strong>Mark as departed</strong> when the vehicle leaves for delivery.
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

                    {canLoadCargo ? (
                        <Box sx={{ mb: 2.5 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    Load vouchers
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Shows vouchers matching this trip&apos;s destination warehouse.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }} alignItems={{ sm: 'center' }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: { sm: 'nowrap' }, flex: { sm: '1 1 auto' } }}>
                                        Vehicle max weight: <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{vehicleMaxWeight === null ? '—' : formatFixed(vehicleMaxWeight, 0)}</Box>
                                        {' · '}
                                        Selected weight: <Box component="span" sx={{ fontWeight: 800, color: selectedExceedsVehicleWeight ? 'error.main' : 'text.primary' }}>{formatFixed(selectedWeightSummary.knownSum, 0)}</Box>
                                        {selectedWeightSummary.unknownCount > 0 ? ` (+ ${selectedWeightSummary.unknownCount} unknown)` : ''}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            gap: 1,
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            justifyContent: { sm: 'flex-end' },
                                            width: { xs: '100%', sm: 'auto' },
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Button
                                            variant="contained"
                                            onClick={() => submitLoadBatch(selectedVoucherIds)}
                                            disabled={loadBatchProcessing || selectedVoucherIds.length === 0 || selectedExceedsVehicleWeight}
                                            fullWidth={!isSmUp}
                                        >
                                            Load selected
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            onClick={() => submitLoadBatch((loadableVouchers || []).map((r) => r.id))}
                                            disabled={loadBatchProcessing || (loadableVouchers || []).length === 0 || allExceedsVehicleWeight}
                                            fullWidth={!isSmUp}
                                        >
                                            Load all
                                        </Button>
                                    </Box>
                                </Stack>
                            </Stack>

                            {errors.voucher_ids || errors.voucher_id ? (
                                <Alert severity="error" sx={{ mb: 1.5 }}>
                                    {Array.isArray(errors.voucher_ids)
                                        ? errors.voucher_ids[0]
                                        : errors.voucher_ids ||
                                          (Array.isArray(errors.voucher_id) ? errors.voucher_id[0] : errors.voucher_id)}
                                </Alert>
                            ) : null}

                            {(loadableVouchers || []).length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    No vouchers available: need confirmed vouchers with remaining quantity for this trip&apos;s destination warehouse.
                                </Typography>
                            ) : (
                                isSmUp ? (
                                    <Paper variant="outlined" sx={{ overflowX: 'auto', borderRadius: 2 }}>
                                        <Table size="small" sx={{ minWidth: 720 }}>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ width: 140 }}>Voucher ID</TableCell>
                                                    <TableCell>Receipt name</TableCell>
                                                    <TableCell align="right" sx={{ width: 140 }}>
                                                        Weight
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ width: 160 }}>
                                                        Items (total line)
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ width: 120 }}>
                                                        <Checkbox
                                                            size="small"
                                                            disabled={loadBatchProcessing}
                                                            checked={(loadableVouchers || []).length > 0 && selectedVoucherIds.length === (loadableVouchers || []).length}
                                                            indeterminate={selectedVoucherIds.length > 0 && selectedVoucherIds.length < (loadableVouchers || []).length}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setSelectedVoucherMap(() => {
                                                                    if (!checked) return {};
                                                                    const next = {};
                                                                    (loadableVouchers || []).forEach((r) => {
                                                                        next[String(r.id)] = true;
                                                                    });
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {(loadableVouchers || []).map((row) => {
                                                    const checked = Boolean(selectedVoucherMap[String(row.id)]);
                                                    const w = row.total_weight;
                                                    return (
                                                        <TableRow key={row.id} hover>
                                                            <TableCell>{row.id}</TableCell>
                                                            <TableCell sx={{ minWidth: 240 }}>
                                                                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={row.recipient_name || undefined}>
                                                                        {row.recipient_name || '—'}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" noWrap title={row.voucher_no || undefined}>
                                                                        {row.voucher_no || '—'}
                                                                    </Typography>
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell align="right">{w === null || w === undefined ? '—' : formatFixed(w, 0)}</TableCell>
                                                            <TableCell align="right">{row.lines ?? 0}</TableCell>
                                                            <TableCell align="right">
                                                                <Checkbox
                                                                    size="small"
                                                                    disabled={loadBatchProcessing}
                                                                    checked={checked}
                                                                    onChange={(e) => {
                                                                        const nextChecked = e.target.checked;
                                                                        setSelectedVoucherMap((prev) => {
                                                                            const next = { ...(prev || {}) };
                                                                            if (nextChecked) {
                                                                                next[String(row.id)] = true;
                                                                            } else {
                                                                                delete next[String(row.id)];
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </Paper>
                                ) : (
                                    <Stack spacing={1}>
                                        <Paper variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2 }}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                    Select all
                                                </Typography>
                                                <Checkbox
                                                    size="small"
                                                    disabled={loadBatchProcessing}
                                                    checked={(loadableVouchers || []).length > 0 && selectedVoucherIds.length === (loadableVouchers || []).length}
                                                    indeterminate={selectedVoucherIds.length > 0 && selectedVoucherIds.length < (loadableVouchers || []).length}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setSelectedVoucherMap(() => {
                                                            if (!checked) return {};
                                                            const next = {};
                                                            (loadableVouchers || []).forEach((r) => {
                                                                next[String(r.id)] = true;
                                                            });
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            </Stack>
                                        </Paper>
                                        {(loadableVouchers || []).map((row) => {
                                            const checked = Boolean(selectedVoucherMap[String(row.id)]);
                                            const w = row.total_weight;
                                            return (
                                                <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                    <Stack spacing={1}>
                                                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                                                    {row.recipient_name || '—'}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {row.voucher_no || '—'} · ID {row.id}
                                                                </Typography>
                                                            </Box>
                                                            <Checkbox
                                                                size="small"
                                                                disabled={loadBatchProcessing}
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const nextChecked = e.target.checked;
                                                                    setSelectedVoucherMap((prev) => {
                                                                        const next = { ...(prev || {}) };
                                                                        if (nextChecked) {
                                                                            next[String(row.id)] = true;
                                                                        } else {
                                                                            delete next[String(row.id)];
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                            />
                                                        </Stack>
                                                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Weight
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                                {w === null || w === undefined ? '—' : formatFixed(w, 0)}
                                                            </Typography>
                                                        </Stack>
                                                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Items (total line)
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                                {row.lines ?? 0}
                                                            </Typography>
                                                        </Stack>
                                                    </Stack>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>
                                )
                            )}
                        </Box>
                    ) : null}

                    {(trip.items || []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            Nothing loaded yet.
                        </Typography>
                    ) : isSmUp ? (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: showCargoActionsColumn || canManageCargo ? 680 : 480 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                        <TableCell sx={{ width: 520 }}>Voucher</TableCell>
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
                                                                        {row.voucher_id ? (
                                                                            <Link href={`${adminAppUrl}/operations/vouchers/${row.voucher_id}`}>{voucherNo}</Link>
                                                                        ) : (
                                                                            voucherNo
                                                                        )}
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
                                                    <TableCell colSpan={showCargoActionsColumn ? 4 : 3} sx={{ py: 0, borderBottom: isOpen ? undefined : 0 }}>
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
                            if (!window.confirm(`Remove voucher ${r.voucher_no} from the trip?`)) return;
                            router.delete(`${adminAppUrl}/operations/trips/${trip.id}/vouchers/${r.voucher_id}`, { preserveScroll: true });
                        }}
                    >
                        Remove from trip
                    </MenuItem>
                </Menu>

                <Dialog open={tripCostDialogOpen} onClose={closeTripCostDialog} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 700 }}>{tripCostForm.id ? 'Edit trip cost' : 'Add trip cost'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.75} sx={{ mt: 1 }}>
                            {tripCostDialogError ? <Alert severity="error">{tripCostDialogError}</Alert> : null}

                            <FormControl fullWidth size="small">
                                <InputLabel id="trip-cost-category-label">Category</InputLabel>
                                <Select
                                    labelId="trip-cost-category-label"
                                    label="Category"
                                    value={tripCostForm.category_id}
                                    onChange={(e) => setTripCostForm((p) => ({ ...p, category_id: e.target.value }))}
                                    disabled={tripCostDialogProcessing}
                                >
                                    {(tripCostCategories || []).map((c) => (
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
                                value={tripCostForm.amount}
                                onChange={(e) => setTripCostForm((p) => ({ ...p, amount: e.target.value }))}
                                fullWidth
                                required
                                disabled={tripCostDialogProcessing}
                                inputProps={{ step: '1', min: 0 }}
                            />

                            <TextField
                                size="small"
                                label="Note"
                                value={tripCostForm.note}
                                onChange={(e) => setTripCostForm((p) => ({ ...p, note: e.target.value }))}
                                fullWidth
                                disabled={tripCostDialogProcessing}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={closeTripCostDialog} disabled={tripCostDialogProcessing}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={submitTripCostDialog} disabled={tripCostDialogProcessing}>
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
                                        step: '1',
                                        min: '0',
                                        max: Math.floor(maxLoadedQtyForTripItem(itemDialog.row, trip.items || [])),
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
                                                    rq = String(Math.round(rem));
                                                } else if (next === 'REJECTED') {
                                                    rq = '0';
                                                } else if (next === 'PARTIAL') {
                                                    const cur = Number(d.received_qty);
                                                    const safe =
                                                        Number.isFinite(cur) && cur > 0 && cur < rem - 0.0001
                                                            ? cur
                                                            : Math.min(rem / 2, rem - 1);
                                                    rq = String(Math.max(1, Math.round(safe)));
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
                                        step: '1',
                                        min: '0',
                                        max:
                                            itemDeliveryDialog.delivery_status === 'FULL'
                                                ? String(Math.round(remainingDeliverQty(itemDeliveryDialog.row)))
                                                : String(Math.round(remainingDeliverQty(itemDeliveryDialog.row))),
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
                                Confirms the vehicle has departed. Voucher lines on this trip will move to <strong>In transit</strong> when applicable.
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
                            Sets the trip back to <strong>planned</strong> so cargo loading can be adjusted again. Only available before any delivery has been recorded.
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
