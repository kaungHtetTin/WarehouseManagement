import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
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
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon, DeleteOutlineOutlined as DeleteIcon, EditOutlined as EditIcon, FilterAltOutlined as FilterIcon } from '@mui/icons-material';
import { Fragment, useCallback, useMemo, useState } from 'react';

function formatMoney(amount, currency) {
    if (amount == null || amount === '' || !Number.isFinite(Number(amount))) {
        return '—';
    }
    const n = Number(amount);
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency || 'MMK'}`;
}

function formatDateTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

export default function FinanceLedger() {
    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const flash = pageProps.flash ?? {};

    const entries = pageProps.entries ?? [];
    const totals = pageProps.totals ?? { income: 0, expense: 0, net: 0 };
    const warehouses = pageProps.warehouses ?? [];
    const categories = pageProps.categories ?? [];
    const canManageFinance = pageProps.can_manage_finance ?? false;

    const filters = pageProps.filters ?? {};
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [direction, setDirection] = useState(filters.direction ?? 'all');
    const [scope, setScope] = useState(filters.scope ?? 'all');
    const [source, setSource] = useState(filters.source ?? 'all');
    const [warehouseId, setWarehouseId] = useState(filters.warehouse_id ?? 'all');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? 'all');

    const applyFilters = useCallback(
        (patch) => {
            router.get(
                `${adminAppUrl}/finance/ledger`,
                {
                    from,
                    to,
                    direction,
                    scope,
                    source,
                    warehouse_id: warehouseId,
                    category_id: categoryId,
                    ...patch,
                },
                { preserveScroll: true },
            );
        },
        [adminAppUrl, from, to, direction, scope, source, warehouseId, categoryId],
    );

    const effectiveCategories = useMemo(() => {
        return (categories || []).filter((c) => {
            if (scope !== 'all' && c.scope !== scope) return false;
            if (direction !== 'all' && c.direction !== 'BOTH' && c.direction !== direction) return false;
            return true;
        });
    }, [categories, scope, direction]);

    const [entryDialogOpen, setEntryDialogOpen] = useState(false);
    const [entryDialogProcessing, setEntryDialogProcessing] = useState(false);
    const [entryDialogError, setEntryDialogError] = useState('');
    const [entryForm, setEntryForm] = useState({
        id: null,
        direction: 'EXPENSE',
        scope: 'GENERAL',
        category_id: '',
        warehouse_id: '',
        amount: '',
        currency: 'MMK',
        occurred_at: new Date().toISOString().slice(0, 10),
        note: '',
    });

    const openCreate = () => {
        setEntryDialogError('');
        setEntryForm({
            id: null,
            direction: 'EXPENSE',
            scope: 'GENERAL',
            category_id: '',
            warehouse_id: '',
            amount: '',
            currency: 'MMK',
            occurred_at: new Date().toISOString().slice(0, 10),
            note: '',
        });
        setEntryDialogOpen(true);
    };

    const openEdit = (row) => {
        setEntryDialogError('');
        setEntryForm({
            id: row.id,
            direction: row.direction ?? 'EXPENSE',
            scope: row.scope ?? 'GENERAL',
            category_id: row.category?.id != null ? String(row.category.id) : '',
            warehouse_id: row.warehouse?.id != null ? String(row.warehouse.id) : '',
            amount: row.amount != null ? String(row.amount) : '',
            currency: row.currency ?? 'MMK',
            occurred_at: row.occurred_at ? String(row.occurred_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
            note: row.note ?? '',
        });
        setEntryDialogOpen(true);
    };

    const closeDialog = () => {
        if (entryDialogProcessing) return;
        setEntryDialogOpen(false);
    };

    const submitEntry = () => {
        if (!canManageFinance) return;
        setEntryDialogError('');

        const amount = Number(entryForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setEntryDialogError('Enter a valid amount.');
            return;
        }
        if (!entryForm.occurred_at) {
            setEntryDialogError('Select a date.');
            return;
        }

        const payload = {
            direction: entryForm.direction,
            scope: entryForm.scope,
            category_id: entryForm.category_id === '' ? null : Number(entryForm.category_id),
            warehouse_id: entryForm.warehouse_id === '' ? null : Number(entryForm.warehouse_id),
            amount,
            currency: entryForm.currency?.trim() || 'MMK',
            occurred_at: entryForm.occurred_at,
            note: entryForm.note?.trim() || null,
        };

        setEntryDialogProcessing(true);
        if (!entryForm.id) {
            router.post(`${adminAppUrl}/finance/entries`, payload, {
                preserveScroll: true,
                onSuccess: () => setEntryDialogOpen(false),
                onFinish: () => setEntryDialogProcessing(false),
            });
            return;
        }

        router.patch(`${adminAppUrl}/finance/entries/${entryForm.id}`, payload, {
            preserveScroll: true,
            onSuccess: () => setEntryDialogOpen(false),
            onFinish: () => setEntryDialogProcessing(false),
        });
    };

    const removeEntry = (row) => {
        if (!canManageFinance) return;
        if (!window.confirm('Delete this finance entry?')) return;
        router.delete(`${adminAppUrl}/finance/entries/${row.id}`, { preserveScroll: true });
    };

    const directionChipColor = (d) => (d === 'INCOME' ? 'success' : 'warning');
    const scopeChipColor = (s) => (s === 'GENERAL' ? 'default' : s === 'VOUCHER' ? 'info' : 'primary');
    const sourceChipColor = (s) => (s === 'SYSTEM' ? 'info' : 'default');

    return (
        <AdminLayout title="Finance Ledger">
            <Head title="Finance Ledger" />
            <Stack spacing={2.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                    Finance Ledger
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    All income/expense events (manual + system generated).
                                </Typography>
                            </Box>
                            {canManageFinance ? (
                                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                                    Add entry
                                </Button>
                            ) : null}
                        </Stack>

                        <Divider />

                        <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    Total income
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatMoney(totals.income, 'MMK')}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    Total expense
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatMoney(totals.expense, 'MMK')}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    Net
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatMoney(totals.net, 'MMK')}
                                </Typography>
                            </Grid>
                        </Grid>

                        <Divider />

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="stretch">
                            <TextField
                                size="small"
                                type="date"
                                label="From"
                                InputLabelProps={{ shrink: true }}
                                value={from}
                                onChange={(e) => {
                                    setFrom(e.target.value);
                                    applyFilters({ from: e.target.value });
                                }}
                                sx={{ width: { xs: '100%', md: 170 } }}
                            />
                            <TextField
                                size="small"
                                type="date"
                                label="To"
                                InputLabelProps={{ shrink: true }}
                                value={to}
                                onChange={(e) => {
                                    setTo(e.target.value);
                                    applyFilters({ to: e.target.value });
                                }}
                                sx={{ width: { xs: '100%', md: 170 } }}
                            />
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 170 } }}>
                                <InputLabel id="fin-direction">Direction</InputLabel>
                                <Select
                                    labelId="fin-direction"
                                    label="Direction"
                                    value={direction}
                                    onChange={(e) => {
                                        setDirection(e.target.value);
                                        applyFilters({ direction: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="INCOME">INCOME</MenuItem>
                                    <MenuItem value="EXPENSE">EXPENSE</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 170 } }}>
                                <InputLabel id="fin-scope">Scope</InputLabel>
                                <Select
                                    labelId="fin-scope"
                                    label="Scope"
                                    value={scope}
                                    onChange={(e) => {
                                        setScope(e.target.value);
                                        applyFilters({ scope: e.target.value, category_id: 'all' });
                                        setCategoryId('all');
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="GENERAL">GENERAL</MenuItem>
                                    <MenuItem value="VOUCHER">VOUCHER</MenuItem>
                                    <MenuItem value="TRIP_COST">TRIP_COST</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 170 } }}>
                                <InputLabel id="fin-source">Source</InputLabel>
                                <Select
                                    labelId="fin-source"
                                    label="Source"
                                    value={source}
                                    onChange={(e) => {
                                        setSource(e.target.value);
                                        applyFilters({ source: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="MANUAL">MANUAL</MenuItem>
                                    <MenuItem value="SYSTEM">SYSTEM</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 220 } }}>
                                <InputLabel id="fin-warehouse">Warehouse</InputLabel>
                                <Select
                                    labelId="fin-warehouse"
                                    label="Warehouse"
                                    value={warehouseId}
                                    onChange={(e) => {
                                        setWarehouseId(e.target.value);
                                        applyFilters({ warehouse_id: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="none">Unassigned</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.display_name || w.city}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 240 } }}>
                                <InputLabel id="fin-category">Category</InputLabel>
                                <Select
                                    labelId="fin-category"
                                    label="Category"
                                    value={categoryId}
                                    onChange={(e) => {
                                        setCategoryId(e.target.value);
                                        applyFilters({ category_id: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {effectiveCategories.map((c) => (
                                        <MenuItem key={c.id} value={String(c.id)}>
                                            {c.scope} · {c.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <FilterIcon fontSize="inherit" />
                            Showing up to the latest 500 entries for the selected filters.
                        </Typography>
                    </Stack>
                </Paper>

                {isMdUp ? (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Direction</TableCell>
                                    <TableCell>Scope</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell>Warehouse</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                    <TableCell>Source</TableCell>
                                    <TableCell>Reference</TableCell>
                                    <TableCell>Note</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {entries.map((row) => {
                                    const canEdit = canManageFinance && row.source === 'MANUAL';
                                    const ref = row.reference;
                                    const refNode = ref ? (
                                        ref.type === 'TRIP' ? (
                                            <Link href={`${adminAppUrl}/operations/trips/${ref.trip_id}`}>Trip #{ref.trip_id}</Link>
                                        ) : ref.type === 'VOUCHER_PAYMENT' && ref.voucher_id ? (
                                            <Link href={`${adminAppUrl}/operations/vouchers/${ref.voucher_id}`}>Voucher #{ref.voucher_id}</Link>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                {ref.type} #{ref.id}
                                            </Typography>
                                        )
                                    ) : (
                                        '—'
                                    );

                                    return (
                                        <TableRow key={row.id} hover>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.occurred_at)}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={row.direction} color={directionChipColor(row.direction)} variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={row.scope} color={scopeChipColor(row.scope)} variant="outlined" />
                                            </TableCell>
                                            <TableCell>{row.category?.name ?? '—'}</TableCell>
                                            <TableCell>{row.warehouse ? `${row.warehouse.display_name}` : '—'}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {formatMoney(row.amount, row.currency)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={row.source} color={sourceChipColor(row.source)} variant="outlined" />
                                            </TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{refNode}</TableCell>
                                            <TableCell sx={{ maxWidth: 360 }} title={row.note ?? ''}>
                                                {row.note || '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ width: 96, whiteSpace: 'nowrap' }}>
                                                {canEdit ? (
                                                    <Fragment>
                                                        <IconButton size="small" onClick={() => openEdit(row)} aria-label="Edit entry">
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => removeEntry(row)} aria-label="Delete entry" sx={{ color: 'error.main' }}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Fragment>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10}>
                                            <Typography variant="body2" color="text.secondary">
                                                No entries for the selected filters.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </Paper>
                ) : (
                    <Stack spacing={1.25}>
                        {entries.map((row) => {
                            const canEdit = canManageFinance && row.source === 'MANUAL';
                            const ref = row.reference;
                            const refNode = ref ? (
                                ref.type === 'TRIP' ? (
                                    <Link href={`${adminAppUrl}/operations/trips/${ref.trip_id}`}>Trip #{ref.trip_id}</Link>
                                ) : ref.type === 'VOUCHER_PAYMENT' && ref.voucher_id ? (
                                    <Link href={`${adminAppUrl}/operations/vouchers/${ref.voucher_id}`}>Voucher #{ref.voucher_id}</Link>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        {ref.type} #{ref.id}
                                    </Typography>
                                )
                            ) : (
                                '—'
                            );

                            return (
                                <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack spacing={1}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                    {formatMoney(row.amount, row.currency)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDateTime(row.occurred_at)}
                                                </Typography>
                                            </Box>
                                            {canEdit ? (
                                                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                                    <IconButton size="small" onClick={() => openEdit(row)} aria-label="Edit entry">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => removeEntry(row)} aria-label="Delete entry" sx={{ color: 'error.main' }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            ) : null}
                                        </Stack>

                                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                                            <Chip size="small" label={row.direction} color={directionChipColor(row.direction)} variant="outlined" />
                                            <Chip size="small" label={row.scope} color={scopeChipColor(row.scope)} variant="outlined" />
                                            <Chip size="small" label={row.source} color={sourceChipColor(row.source)} variant="outlined" />
                                        </Stack>

                                        <Grid container spacing={1}>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Category
                                                </Typography>
                                                <Typography variant="body2">{row.category?.name ?? '—'}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Warehouse
                                                </Typography>
                                                <Typography variant="body2">
                                                    {row.warehouse ? `${row.warehouse.display_name}` : '—'}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Reference
                                                </Typography>
                                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                                    {refNode}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Note
                                                </Typography>
                                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                                    {row.note || '—'}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                </Paper>
                            );
                        })}
                        {entries.length === 0 ? (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    No entries for the selected filters.
                                </Typography>
                            </Paper>
                        ) : null}
                    </Stack>
                )}

                <Dialog open={entryDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
                    <DialogTitle sx={{ fontWeight: 800 }}>{entryForm.id ? 'Edit entry' : 'Add entry'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.5} sx={{ mt: 1 }}>
                            {entryDialogError ? <Alert severity="error">{entryDialogError}</Alert> : null}

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-direction">Direction</InputLabel>
                                    <Select
                                        labelId="entry-direction"
                                        label="Direction"
                                        value={entryForm.direction}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setEntryForm((p) => ({ ...p, direction: next, category_id: '' }));
                                        }}
                                        disabled={entryDialogProcessing}
                                    >
                                        <MenuItem value="EXPENSE">EXPENSE</MenuItem>
                                        <MenuItem value="INCOME">INCOME</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-scope">Scope</InputLabel>
                                    <Select
                                        labelId="entry-scope"
                                        label="Scope"
                                        value={entryForm.scope}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setEntryForm((p) => ({ ...p, scope: next, category_id: '' }));
                                        }}
                                        disabled={entryDialogProcessing}
                                    >
                                        <MenuItem value="GENERAL">GENERAL</MenuItem>
                                        <MenuItem value="VOUCHER">VOUCHER</MenuItem>
                                        <MenuItem value="TRIP_COST">TRIP_COST</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-category">Category</InputLabel>
                                    <Select
                                        labelId="entry-category"
                                        label="Category"
                                        value={entryForm.category_id}
                                        onChange={(e) => setEntryForm((p) => ({ ...p, category_id: e.target.value }))}
                                        disabled={entryDialogProcessing}
                                    >
                                        <MenuItem value="">
                                            <Typography variant="body2" color="text.secondary">
                                                Not set
                                            </Typography>
                                        </MenuItem>
                                        {(categories || [])
                                            .filter((c) => c.scope === entryForm.scope)
                                            .filter((c) => c.direction === 'BOTH' || c.direction === entryForm.direction)
                                            .map((c) => (
                                                <MenuItem key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-warehouse">Warehouse</InputLabel>
                                    <Select
                                        labelId="entry-warehouse"
                                        label="Warehouse"
                                        value={entryForm.warehouse_id}
                                        onChange={(e) => setEntryForm((p) => ({ ...p, warehouse_id: e.target.value }))}
                                        disabled={entryDialogProcessing}
                                    >
                                        <MenuItem value="">
                                            <Typography variant="body2" color="text.secondary">
                                                Unassigned
                                            </Typography>
                                        </MenuItem>
                                        {warehouses.map((w) => (
                                            <MenuItem key={w.id} value={String(w.id)}>
                                                {w.display_name || w.city}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    size="small"
                                    label="Amount"
                                    type="number"
                                    value={entryForm.amount}
                                    onChange={(e) => setEntryForm((p) => ({ ...p, amount: e.target.value }))}
                                    fullWidth
                                    required
                                    disabled={entryDialogProcessing}
                                    inputProps={{ step: '0.01', min: 0 }}
                                />
                                <TextField
                                    size="small"
                                    label="Currency"
                                    value={entryForm.currency}
                                    onChange={(e) => setEntryForm((p) => ({ ...p, currency: e.target.value }))}
                                    fullWidth
                                    disabled={entryDialogProcessing}
                                />
                                <TextField
                                    size="small"
                                    type="date"
                                    label="Date"
                                    InputLabelProps={{ shrink: true }}
                                    value={entryForm.occurred_at}
                                    onChange={(e) => setEntryForm((p) => ({ ...p, occurred_at: e.target.value }))}
                                    fullWidth
                                    required
                                    disabled={entryDialogProcessing}
                                />
                            </Stack>

                            <TextField
                                size="small"
                                label="Note"
                                value={entryForm.note}
                                onChange={(e) => setEntryForm((p) => ({ ...p, note: e.target.value }))}
                                fullWidth
                                disabled={entryDialogProcessing}
                                multiline
                                minRows={isSmUp ? 2 : 3}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={closeDialog} disabled={entryDialogProcessing}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={submitEntry} disabled={entryDialogProcessing}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
