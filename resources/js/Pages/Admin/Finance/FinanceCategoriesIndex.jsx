import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, router, usePage } from '@inertiajs/react';
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
    Fab,
    FormControl,
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
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

const emptyForm = {
    id: null,
    direction: 'EXPENSE',
    name: '',
    status: 'ACTIVE',
    sort_order: '0',
};

export default function FinanceCategoriesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const { categories = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('finance.manage');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);

    const openActions = Boolean(tableActionAnchorEl);

    const statusColor = (s) => (s === 'ACTIVE' ? 'success' : 'default');
    const directionColor = (d) => (d === 'INCOME' ? 'success' : d === 'EXPENSE' ? 'warning' : 'default');

    const sorted = useMemo(() => {
        const out = [...categories];
        out.sort((a, b) => {
            const s = String(a.scope ?? '').localeCompare(String(b.scope ?? ''));
            if (s !== 0) return s;
            const d = String(a.direction ?? '').localeCompare(String(b.direction ?? ''));
            if (d !== 0) return d;
            const ao = Number(a.sort_order ?? 0);
            const bo = Number(b.sort_order ?? 0);
            if (ao !== bo) return ao - bo;
            return String(a.name ?? '').localeCompare(String(b.name ?? ''));
        });
        return out;
    }, [categories]);

    const openCreate = () => {
        setError('');
        setForm({ ...emptyForm });
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setError('');
        setForm({
            id: row.id,
            direction: row.direction ?? 'EXPENSE',
            name: row.name ?? '',
            status: row.status ?? 'ACTIVE',
            sort_order: row.sort_order != null ? String(row.sort_order) : '0',
        });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (processing) return;
        setDialogOpen(false);
    };

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRow(null);
    };

    const removeRow = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(t('finance.categories.confirm.delete', { name: row.name }))) return;
        router.delete(`${adminAppUrl}/finance/categories/${row.id}`, { preserveScroll: true });
    };

    const submit = () => {
        if (!canManage) return;
        setError('');
        const name = form.name.trim();
        if (!name) {
            setError(t('finance.categories.errors.enter_name'));
            return;
        }

        const payload = {
            direction: form.direction,
            name,
            status: form.status,
            sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
        };

        setProcessing(true);
        if (!form.id) {
            router.post(`${adminAppUrl}/finance/categories`, payload, {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
                onSuccess: () => setDialogOpen(false),
            });
            return;
        }

        router.patch(`${adminAppUrl}/finance/categories/${form.id}`, payload, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
            onSuccess: () => setDialogOpen(false),
        });
    };

    return (
        <AdminLayout title={t('finance.categories.title')}>
            <Head title={t('finance.categories.title')} />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    title={t('finance.categories.title')}
                    subtitle={t('finance.categories.subtitle')}
                    actions={
                        canManage ? (
                            <Fab size="small" color="primary" onClick={openCreate} aria-label={t('finance.categories.actions.add_category')} sx={{ boxShadow: 2 }}>
                                <AddIcon fontSize="small" />
                            </Fab>
                        ) : null
                    }
                />

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {sorted.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.name}>
                                            {row.name}
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                            <Chip size="small" label={row.direction ?? 'BOTH'} color={directionColor(row.direction)} variant="outlined" />
                                            <Chip size="small" label={row.status ?? 'ACTIVE'} color={statusColor(row.status)} variant="outlined" />
                                            <Chip size="small" label={t('finance.categories.order_chip', { order: row.sort_order ?? 0 })} variant="outlined" />
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label={t('finance.categories.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {sorted.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('finance.categories.empty')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('finance.categories.table.name')}</TableCell>
                                    <TableCell>{t('finance.categories.table.direction')}</TableCell>
                                    <TableCell>{t('finance.categories.table.status')}</TableCell>
                                    <TableCell>{t('finance.categories.table.sort')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sorted.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.direction ?? 'BOTH'} color={directionColor(row.direction)} variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.status ?? 'ACTIVE'} color={statusColor(row.status)} variant="outlined" />
                                        </TableCell>
                                        <TableCell>{row.sort_order ?? 0}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label={t('finance.categories.actions.row_actions')}>
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sorted.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('finance.categories.empty')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                )}

                <Menu
                    anchorEl={tableActionAnchorEl}
                    open={openActions}
                    onClose={handleTableActionClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <MenuItem dense onClick={() => selectedRow && openEdit(selectedRow)} disabled={!canManage}>
                        {t('ui.edit')}
                    </MenuItem>
                    <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)} disabled={!canManage}>
                        {t('ui.delete')}
                    </MenuItem>
                </Menu>

                <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 700 }}>
                        {form.id ? t('finance.categories.dialog.edit_title') : t('finance.categories.dialog.add_title')}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                            {error ? <Alert severity="error">{error}</Alert> : null}
                            <FormControl fullWidth size="small">
                                <InputLabel id="finance-category-direction">{t('finance.categories.table.direction')}</InputLabel>
                                <Select
                                    labelId="finance-category-direction"
                                    label={t('finance.categories.table.direction')}
                                    value={form.direction}
                                    disabled={processing}
                                    onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))}
                                >
                                    <MenuItem value="EXPENSE">EXPENSE</MenuItem>
                                    <MenuItem value="INCOME">INCOME</MenuItem>
                                    <MenuItem value="BOTH">BOTH</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label={t('finance.categories.table.name')}
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                fullWidth
                                autoFocus
                                disabled={processing}
                            />
                            <FormControl fullWidth size="small">
                                <InputLabel id="finance-category-status">{t('finance.categories.table.status')}</InputLabel>
                                <Select
                                    labelId="finance-category-status"
                                    label={t('finance.categories.table.status')}
                                    value={form.status}
                                    disabled={processing}
                                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                                >
                                    <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                    <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label={t('finance.categories.fields.sort_order')}
                                value={form.sort_order}
                                onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                                fullWidth
                                disabled={processing}
                                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={closeDialog} disabled={processing}>
                            {t('ui.cancel')}
                        </Button>
                        <Button variant="contained" onClick={submit} disabled={processing}>
                            {t('ui.save')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}
