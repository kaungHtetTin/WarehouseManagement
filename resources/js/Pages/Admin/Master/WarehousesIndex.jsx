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
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useState } from 'react';

const initialForm = {
    id: null,
    code: '',
    name: '',
    city: '',
    address: '',
    phone: '',
    is_main: false,
    status: 'ACTIVE',
};

export default function WarehousesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const page = usePage();
    const { warehouses = [], admin_app_url: adminAppUrl, flash = {}, auth } = page.props;
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('warehouses.manage');

    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRow(null);
    };

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (row) => {
        setForm({
            id: row.id,
            code: row.code ?? '',
            name: row.name ?? '',
            city: row.city ?? '',
            address: row.address ?? '',
            phone: row.phone ?? '',
            is_main: Boolean(row.is_main),
            status: row.status ?? 'ACTIVE',
        });
        setError('');
        setOpen(true);
    };

    const closeDialog = () => {
        if (!processing) {
            setOpen(false);
            setForm(initialForm);
            setError('');
        }
    };

    const submit = () => {
        setProcessing(true);
        setError('');

        const payload = {
            code: form.code,
            name: form.name,
            city: form.city,
            address: form.address || null,
            phone: form.phone || null,
            is_main: form.is_main,
            status: form.status,
        };

        const options = {
            preserveScroll: true,
            onError: () => setError('Unable to save warehouse. Please check fields and try again.'),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };

        if (form.id) {
            router.patch(`${adminAppUrl}/master/warehouses/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/master/warehouses`, payload, options);
        }
    };

    const removeRow = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(`Delete warehouse "${row.name}"?`)) return;

        router.delete(`${adminAppUrl}/master/warehouses/${row.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title="Warehouses">
            <Head title="Warehouses" />
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
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Warehouses
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Master data for warehouse locations in your organization.
                        </Typography>
                    </Box>
                    {canManage && (
                        <Tooltip title="New warehouse" placement="bottom">
                            <Fab
                                color="primary"
                                size="small"
                                onClick={openCreate}
                                aria-label="Create warehouse"
                                sx={{ boxShadow: 2, alignSelf: { xs: 'flex-end', md: 'auto' } }}
                            >
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Tooltip>
                    )}
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {warehouses.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.name}>
                                            {row.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.8125rem' }}>
                                            {row.code} · {row.city}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                                            <Chip
                                                size="small"
                                                label={row.status}
                                                color={row.status === 'ACTIVE' ? 'success' : 'default'}
                                                variant={row.status === 'ACTIVE' ? 'filled' : 'outlined'}
                                            />
                                            {row.is_main && <Chip size="small" label="Main" color="primary" variant="outlined" />}
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(event) => handleTableActionOpen(event, row)}
                                            aria-label="Warehouse actions"
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {warehouses.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No warehouses yet.
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Code</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>City</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {warehouses.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>{row.code}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                                <span>{row.name}</span>
                                                {row.is_main && <Chip size="small" label="Main" />}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{row.city}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.status}
                                                color={row.status === 'ACTIVE' ? 'success' : 'default'}
                                                variant={row.status === 'ACTIVE' ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => handleTableActionOpen(event, row)}
                                                    aria-label="Warehouse actions"
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {warehouses.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                No warehouses yet.
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
                    open={openTableActionMenu}
                    onClose={handleTableActionClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <MenuItem
                        dense
                        onClick={() => {
                            if (selectedRow) openEdit(selectedRow);
                            handleTableActionClose();
                        }}
                    >
                        Edit
                    </MenuItem>
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (selectedRow) removeRow(selectedRow);
                        }}
                    >
                        Delete
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? 'Edit Warehouse' : 'Create Warehouse'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Code"
                            value={form.code}
                            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                            helperText="Unique within your organization"
                        />
                        <TextField label="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <TextField label="City" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
                        <TextField
                            label="Address"
                            value={form.address}
                            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                        />
                        <TextField label="Phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={form.is_main}
                                    onChange={(e) => setForm((prev) => ({ ...prev, is_main: e.target.checked }))}
                                />
                            }
                            label="Main warehouse"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={form.status}
                                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                            >
                                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} disabled={processing}>
                        Cancel
                    </Button>
                    <Button onClick={submit} variant="contained" disabled={processing || !canManage}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
