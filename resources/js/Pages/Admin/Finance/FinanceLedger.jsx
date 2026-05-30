import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
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
    Menu,
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
import { Add as AddIcon, DeleteOutlineOutlined as DeleteIcon, EditOutlined as EditIcon, FilterAltOutlined as FilterIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { Fragment, useCallback, useMemo, useState } from 'react';

function formatMoney(amount, currency) {
    if (amount == null || amount === '' || !Number.isFinite(Number(amount))) {
        return '—';
    }
    const n = Number(amount);
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)} ${currency || 'MMK'}`;
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
    const t = useT();

    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const flash = pageProps.flash ?? {};

    const entries = pageProps.entries ?? [];
    const totals = pageProps.totals ?? { income: 0, expense: 0, net: 0 };
    const categories = pageProps.categories ?? [];
    const canManageFinance = pageProps.can_manage_finance ?? false;

    const filters = pageProps.filters ?? {};
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [direction, setDirection] = useState(filters.direction ?? 'all');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? 'all');

    const applyFilters = useCallback(
        (patch) => {
            router.get(
                `${adminAppUrl}/finance/ledger`,
                {
                    from,
                    to,
                    direction,
                    category_id: categoryId,
                    ...patch,
                },
                { preserveScroll: true },
            );
        },
        [adminAppUrl, from, to, direction, categoryId],
    );

    const effectiveCategories = useMemo(() => {
        return (categories || []).filter((c) => {
            if (direction !== 'all' && c.direction !== 'BOTH' && c.direction !== direction) return false;
            return true;
        });
    }, [categories, direction]);

    const [entryDialogOpen, setEntryDialogOpen] = useState(false);
    const [entryDialogProcessing, setEntryDialogProcessing] = useState(false);
    const [entryDialogError, setEntryDialogError] = useState('');
    const [rowMenu, setRowMenu] = useState(null);
    const [entryForm, setEntryForm] = useState({
        id: null,
        direction: 'EXPENSE',
        category_id: '',
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
            category_id: '',
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
            category_id: row.category?.id != null ? String(row.category.id) : '',
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

        if (!entryForm.category_id) {
            setEntryDialogError(t('finance.ledger.errors.select_category'));
            return;
        }
        const amount = Number(entryForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setEntryDialogError(t('finance.ledger.errors.valid_amount'));
            return;
        }
        if (!entryForm.occurred_at) {
            setEntryDialogError(t('finance.ledger.errors.select_date'));
            return;
        }

        const payload = {
            direction: entryForm.direction,
            category_id: Number(entryForm.category_id),
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
        if (!window.confirm(t('finance.ledger.confirm.delete_entry'))) return;
        router.delete(`${adminAppUrl}/finance/entries/${row.id}`, { preserveScroll: true });
    };

    const directionChipColor = (d) => (d === 'INCOME' ? 'success' : 'warning');

    return (
        <AdminLayout title={t('finance.ledger.title')}>
            <Head title={t('finance.ledger.title')} />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    title={t('finance.ledger.title')}
                    subtitle={t('finance.ledger.subtitle')}
                    actions={
                        canManageFinance ? (
                            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                                {t('finance.ledger.actions.add_entry')}
                            </Button>
                        ) : null
                    }
                >
                    <Stack spacing={1.25}>
                        <Grid container spacing={1.25}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('finance.totals.total_income')}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatMoney(totals.income, 'MMK')}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('finance.totals.total_expense')}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {formatMoney(totals.expense, 'MMK')}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('finance.totals.net')}
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
                                label={t('filters.from')}
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
                                label={t('filters.to')}
                                InputLabelProps={{ shrink: true }}
                                value={to}
                                onChange={(e) => {
                                    setTo(e.target.value);
                                    applyFilters({ to: e.target.value });
                                }}
                                sx={{ width: { xs: '100%', md: 170 } }}
                            />
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 170 } }}>
                                <InputLabel id="fin-direction">{t('finance.ledger.filters.direction')}</InputLabel>
                                <Select
                                    labelId="fin-direction"
                                    label={t('finance.ledger.filters.direction')}
                                    value={direction}
                                    onChange={(e) => {
                                        setDirection(e.target.value);
                                        applyFilters({ direction: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
                                    <MenuItem value="INCOME">{t('finance.direction.income')}</MenuItem>
                                    <MenuItem value="EXPENSE">{t('finance.direction.expense')}</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 240 } }}>
                                <InputLabel id="fin-category">{t('finance.ledger.filters.category')}</InputLabel>
                                <Select
                                    labelId="fin-category"
                                    label={t('finance.ledger.filters.category')}
                                    value={categoryId}
                                    onChange={(e) => {
                                        setCategoryId(e.target.value);
                                        applyFilters({ category_id: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
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
                            {t('finance.ledger.filters.limit_hint')}
                        </Typography>
                    </Stack>
                </PageHeader>

                {isMdUp ? (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('finance.ledger.table.date')}</TableCell>
                                    <TableCell>{t('finance.ledger.table.direction')}</TableCell>
                                    <TableCell>{t('finance.ledger.table.category')}</TableCell>
                                    <TableCell align="right">{t('finance.ledger.table.amount')}</TableCell>
                                    <TableCell>{t('finance.ledger.table.note')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {entries.map((row) => {
                                    const canEdit = canManageFinance && (row.source === 'MANUAL' || row.reference_type === 'TRIP_NET_INCOME');

                                    return (
                                        <TableRow key={row.id} hover>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.occurred_at)}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={row.direction} color={directionChipColor(row.direction)} variant="outlined" />
                                            </TableCell>
                                            <TableCell>{row.category?.name ?? '—'}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {formatMoney(row.amount, row.currency)}
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 360 }} title={row.note ?? ''}>
                                                {row.note || '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ width: 96, whiteSpace: 'nowrap' }}>
                                                {canEdit ? (
                                                    <IconButton
                                                        size="small"
                                                        aria-label={t('finance.ledger.actions.entry_actions')}
                                                        onClick={(e) => setRowMenu({ anchorEl: e.currentTarget, row })}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('finance.ledger.empty')}
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
                            const canEdit = canManageFinance && (row.source === 'MANUAL' || row.reference_type === 'TRIP_NET_INCOME');

                            return (
                                <Paper key={row.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
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
                                                    <IconButton size="small" onClick={() => openEdit(row)} aria-label={t('ui.edit')}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => removeEntry(row)} aria-label={t('ui.delete')} sx={{ color: 'error.main' }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            ) : null}
                                        </Stack>

                                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                                            <Chip size="small" label={row.direction} color={directionChipColor(row.direction)} variant="outlined" />
                                        </Stack>

                                        <Grid container spacing={1}>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('finance.ledger.table.category')}
                                                </Typography>
                                                <Typography variant="body2">{row.category?.name ?? '—'}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('finance.ledger.table.note')}
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
                            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('finance.ledger.empty')}
                                </Typography>
                            </Paper>
                        ) : null}
                    </Stack>
                )}

                <Menu
                    anchorEl={rowMenu?.anchorEl}
                    open={Boolean(rowMenu?.anchorEl)}
                    onClose={() => setRowMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        dense
                        onClick={() => {
                            if (!rowMenu?.row) return;
                            const row = rowMenu.row;
                            setRowMenu(null);
                            openEdit(row);
                        }}
                    >
                        {t('ui.edit')}
                    </MenuItem>
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (!rowMenu?.row) return;
                            const row = rowMenu.row;
                            setRowMenu(null);
                            removeEntry(row);
                        }}
                    >
                        {t('ui.delete')}
                    </MenuItem>
                </Menu>

                <Dialog open={entryDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
                    <DialogTitle sx={{ fontWeight: 800 }}>
                        {entryForm.id ? t('finance.ledger.dialog.edit_title') : t('finance.ledger.dialog.add_title')}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.25} sx={{ mt: 1 }}>
                            {entryDialogError ? <Alert severity="error">{entryDialogError}</Alert> : null}

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-direction">{t('finance.ledger.table.direction')}</InputLabel>
                                    <Select
                                        labelId="entry-direction"
                                        label={t('finance.ledger.table.direction')}
                                        value={entryForm.direction}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setEntryForm((p) => ({ ...p, direction: next, category_id: '' }));
                                        }}
                                        disabled={entryDialogProcessing}
                                    >
                                        <MenuItem value="EXPENSE">{t('finance.direction.expense')}</MenuItem>
                                        <MenuItem value="INCOME">{t('finance.direction.income')}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="entry-category">{t('finance.ledger.table.category')}</InputLabel>
                                    <Select
                                        labelId="entry-category"
                                        label={t('finance.ledger.table.category')}
                                        value={entryForm.category_id}
                                        onChange={(e) => setEntryForm((p) => ({ ...p, category_id: e.target.value }))}
                                        disabled={entryDialogProcessing}
                                    >
                                        {(categories || [])
                                            .filter((c) => c.direction === 'BOTH' || c.direction === entryForm.direction)
                                            .map((c) => (
                                                <MenuItem key={c.id} value={String(c.id)}>
                                                    {c.scope} · {c.name}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    size="small"
                                    label={t('finance.ledger.table.amount')}
                                    type="number"
                                    value={entryForm.amount}
                                    onChange={(e) => setEntryForm((p) => ({ ...p, amount: e.target.value }))}
                                    fullWidth
                                    required
                                    disabled={entryDialogProcessing}
                                    inputProps={{ step: '1', min: 0 }}
                                />
                                <TextField
                                    size="small"
                                    label={t('finance.ledger.fields.currency')}
                                    value={entryForm.currency}
                                    onChange={(e) => setEntryForm((p) => ({ ...p, currency: e.target.value }))}
                                    fullWidth
                                    disabled={entryDialogProcessing}
                                />
                                <TextField
                                    size="small"
                                    type="date"
                                    label={t('finance.ledger.table.date')}
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
                                label={t('finance.ledger.table.note')}
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
                            {t('ui.cancel')}
                        </Button>
                        <Button variant="contained" onClick={submitEntry} disabled={entryDialogProcessing}>
                            {t('ui.save')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
