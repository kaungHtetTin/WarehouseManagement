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
import { useState } from 'react';

const initialForm = {
    id: null,
    warehouse_id: '',
    vehicle_no: '',
    vehicle_type: '',
    capacity_weight: '',
    capacity_volume: '',
    status: 'ACTIVE',
};

export default function VehiclesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const { vehicles = [], warehouses = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const canManage = (auth?.permission_codes ?? []).includes('inventory.manage');
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
            warehouse_id: row.warehouse_id ?? '',
            vehicle_no: row.vehicle_no ?? '',
            vehicle_type: row.vehicle_type ?? '',
            capacity_weight: row.capacity_weight ?? '',
            capacity_volume: row.capacity_volume ?? '',
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
            warehouse_id: form.warehouse_id || null,
            vehicle_no: form.vehicle_no,
            vehicle_type: form.vehicle_type,
            capacity_weight: form.capacity_weight || null,
            capacity_volume: form.capacity_volume || null,
            status: form.status,
        };
        const options = {
            preserveScroll: true,
            onError: () => setError('Unable to save vehicle. Please check fields and try again.'),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };
        if (form.id) {
            router.patch(`${adminAppUrl}/master/vehicles/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/master/vehicles`, payload, options);
        }
    };

    const removeRow = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(`Delete vehicle "${row.vehicle_no}"?`)) return;
        router.delete(`${adminAppUrl}/master/vehicles/${row.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title="Vehicles">
            <Head title="Vehicles" />
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
                            Vehicles
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Fleet registered for trips and deliveries.
                        </Typography>
                    </Box>
                    {canManage && (
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                                flexShrink: 0,
                                alignItems: 'center',
                                alignSelf: { xs: 'flex-end', md: 'auto' },
                            }}
                        >
                            <Fab size="small" color="primary" onClick={openCreate} aria-label="Create vehicle" sx={{ boxShadow: 2 }}>
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Stack>
                    )}
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {vehicles.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.vehicle_no}>
                                            {row.vehicle_no}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                        >
                                            {[row.vehicle_type, row.warehouse?.name].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                                            <Chip size="small" label={row.status} variant="outlined" />
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label="Vehicle actions"
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {vehicles.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No vehicles yet.
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Registration</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Warehouse</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {vehicles.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>{row.vehicle_no}</TableCell>
                                        <TableCell>{row.vehicle_type}</TableCell>
                                        <TableCell>{row.warehouse?.name || '—'}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.status} variant="outlined" />
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label="Vehicle actions">
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {vehicles.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                No vehicles yet.
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
                    <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)}>
                        Delete
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? 'Edit Vehicle' : 'Create Vehicle'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Registration no."
                            value={form.vehicle_no}
                            onChange={(e) => setForm((p) => ({ ...p, vehicle_no: e.target.value }))}
                        />
                        <TextField
                            label="Vehicle type"
                            placeholder="truck, van, …"
                            value={form.vehicle_type}
                            onChange={(e) => setForm((p) => ({ ...p, vehicle_type: e.target.value }))}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Home warehouse</InputLabel>
                            <Select
                                label="Home warehouse"
                                value={form.warehouse_id}
                                onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}
                            >
                                <MenuItem value="">None</MenuItem>
                                {warehouses.map((w) => (
                                    <MenuItem key={w.id} value={w.id}>
                                        {w.name} ({w.code})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Capacity weight (optional)"
                            type="number"
                            value={form.capacity_weight}
                            onChange={(e) => setForm((p) => ({ ...p, capacity_weight: e.target.value }))}
                            inputProps={{ min: 0, step: 'any' }}
                        />
                        <TextField
                            label="Capacity volume (optional)"
                            type="number"
                            value={form.capacity_volume}
                            onChange={(e) => setForm((p) => ({ ...p, capacity_volume: e.target.value }))}
                            inputProps={{ min: 0, step: 'any' }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
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
