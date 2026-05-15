import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
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
    scope: 'GENERAL',
    direction: 'EXPENSE',
    name: '',
    status: 'ACTIVE',
    sort_order: '0',
};

const SCOPE_OPTIONS = [
    { value: 'all', label: 'All scopes' },
    { value: 'GENERAL', label: 'GENERAL' },
    { value: 'VOUCHER', label: 'VOUCHER' },
    { value: 'TRIP_COST', label: 'TRIP_COST' },
];

export default function FinanceCategoriesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const { categories = [], filters = {}, admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('finance.manage');

    const selectedScope = filters.scope ?? 'all';

    const [dialogOpen, setDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);

    const openActions = Boolean(tableActionAnchorEl);

    const statusColor = (s) => (s === 'ACTIVE' ? 'success' : 'default');
    const directionColor = (d) => (d === 'INCOME' ? 'success' : d === 'EXPENSE' ? 'warning' : 'default');
    const scopeColor = (s) => (s === 'GENERAL' ? 'default' : s === 'VOUCHER' ? 'info' : 'primary');

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
        setForm({ ...emptyForm, scope: selectedScope !== 'all' ? selectedScope : 'GENERAL' });
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setError('');
        setForm({
            id: row.id,
            scope: row.scope ?? 'GENERAL',
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
        if (!window.confirm(`Delete category "${row.name}"?`)) return;
        router.delete(`${adminAppUrl}/finance/categories/${row.id}`, { preserveScroll: true });
    };

    const submit = () => {
        if (!canManage) return;
        setError('');
        const name = form.name.trim();
        if (!name) {
            setError('Enter a category name.');
            return;
        }

        const payload = {
            scope: form.scope,
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
        <AdminLayout title="Finance Categories">
            <Head title="Finance Categories" />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    sx={{
                        mb: 0.5,
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', md: 'center' },
                    }}
                >
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Finance Categories
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Predefined categories for income/expense analysis.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25 }}>
                            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
                                <InputLabel id="finance-scope-filter">Scope</InputLabel>
                                <Select
                                    labelId="finance-scope-filter"
                                    label="Scope"
                                    value={selectedScope}
                                    onChange={(e) => router.get(`${adminAppUrl}/finance/categories`, { scope: e.target.value }, { preserveScroll: true })}
                                >
                                    {SCOPE_OPTIONS.map((o) => (
                                        <MenuItem key={o.value} value={o.value}>
                                            {o.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                    </Box>
                    {canManage && (
                        <Fab size="small" color="primary" onClick={openCreate} aria-label="Add category" sx={{ boxShadow: 2 }}>
                            <AddIcon fontSize="small" />
                        </Fab>
                    )}
                </Stack>

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
                                            <Chip size="small" label={row.scope ?? 'GENERAL'} color={scopeColor(row.scope)} variant="outlined" />
                                            <Chip size="small" label={row.direction ?? 'BOTH'} color={directionColor(row.direction)} variant="outlined" />
                                            <Chip size="small" label={row.status ?? 'ACTIVE'} color={statusColor(row.status)} variant="outlined" />
                                            <Chip size="small" label={`Order ${row.sort_order ?? 0}`} variant="outlined" />
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label="Category actions"
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
                                    No categories yet.
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Scope</TableCell>
                                    <TableCell>Direction</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Sort</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sorted.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.scope ?? 'GENERAL'} color={scopeColor(row.scope)} variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.direction ?? 'BOTH'} color={directionColor(row.direction)} variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.status ?? 'ACTIVE'} color={statusColor(row.status)} variant="outlined" />
                                        </TableCell>
                                        <TableCell>{row.sort_order ?? 0}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label="Category actions">
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sorted.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                No categories yet.
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
                        Edit
                    </MenuItem>
                    <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)} disabled={!canManage}>
                        Delete
                    </MenuItem>
                </Menu>

                <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 700 }}>{form.id ? 'Edit category' : 'Add category'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                            {error ? <Alert severity="error">{error}</Alert> : null}
                            <FormControl fullWidth size="small">
                                <InputLabel id="finance-category-scope">Scope</InputLabel>
                                <Select
                                    labelId="finance-category-scope"
                                    label="Scope"
                                    value={form.scope}
                                    disabled={processing}
                                    onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
                                >
                                    <MenuItem value="GENERAL">GENERAL</MenuItem>
                                    <MenuItem value="VOUCHER">VOUCHER</MenuItem>
                                    <MenuItem value="TRIP_COST">TRIP_COST</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel id="finance-category-direction">Direction</InputLabel>
                                <Select
                                    labelId="finance-category-direction"
                                    label="Direction"
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
                                label="Name"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                fullWidth
                                autoFocus
                                disabled={processing}
                            />
                            <FormControl fullWidth size="small">
                                <InputLabel id="finance-category-status">Status</InputLabel>
                                <Select
                                    labelId="finance-category-status"
                                    label="Status"
                                    value={form.status}
                                    disabled={processing}
                                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                                >
                                    <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                    <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label="Sort order"
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
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={submit} disabled={processing}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}

