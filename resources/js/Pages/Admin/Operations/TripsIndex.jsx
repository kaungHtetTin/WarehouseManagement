import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
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
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

const TRIP_STATUS_COLOR = {
    PLANNED: 'default',
    LOADING: 'info',
    DEPARTED: 'primary',
    AT_STOP: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

export default function TripsIndex() {
    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
    const t = useT();
    const pageProps = usePage().props;
    const {
        trips = [],
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
        trip_destination_filter: tripDestinationFilter = 'all',
        trip_filter_warehouses: tripFilterWarehouses = [],
    } = pageProps;
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('trips.manage');
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const rows = useMemo(() => trips ?? [], [trips]);

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRow(null);
    };

    const viewTrip = (row) => {
        handleTableActionClose();
        if (!row?.id) return;
        router.visit(`${adminAppUrl}/operations/trips/${row.id}`);
    };

    const openManifest = (row) => {
        handleTableActionClose();
        if (!row?.id) return;
        window.open(`${adminAppUrl}/operations/trips/${row.id}/manifest`, '_blank', 'noopener,noreferrer');
    };

    const markDeparted = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!row?.id) return;
        if (!(row?.status === 'PLANNED' || row?.status === 'LOADING')) return;
        if (!window.confirm(t('trips.confirm.mark_departed', { trip_no: row.trip_no }))) return;
        router.patch(`${adminAppUrl}/operations/trips/${row.id}/status`, { target_status: 'DEPARTED' }, { preserveScroll: true });
    };

    const confirmDelivered = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!row?.id) return;
        if (!(row?.status === 'PLANNED' || row?.status === 'LOADING' || row?.status === 'DEPARTED' || row?.status === 'AT_STOP')) return;
        if (!window.confirm(t('trips.confirm.confirm_delivery', { trip_no: row.trip_no }))) return;
        router.post(`${adminAppUrl}/operations/trips/${row.id}/delivery-confirmations`, {}, { preserveScroll: true });
    };

    const deleteTrip = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!row?.id) return;
        if (!(row?.status === 'PLANNED' || row?.status === 'CANCELLED')) return;
        if (!window.confirm(t('trips.confirm.delete_trip', { trip_no: row.trip_no }))) return;
        router.delete(`${adminAppUrl}/operations/trips/${row.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('nav.trips')}>
            <Head title={t('nav.trips')} />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    title={t('nav.trips')}
                    subtitle={t('trips.subtitle')}
                    actions={
                        canManage
                            ? isSmUp
                                ? (
                                    <Fab
                                        component={Link}
                                        href={`${adminAppUrl}/operations/trips/create`}
                                        size="small"
                                        color="primary"
                                        aria-label={t('trips.actions.create_trip')}
                                        sx={{ flexShrink: 0, boxShadow: 2 }}
                                    >
                                        <AddIcon fontSize="small" />
                                    </Fab>
                                )
                                : (
                                    <Button
                                        component={Link}
                                        href={`${adminAppUrl}/operations/trips/create`}
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        fullWidth
                                        sx={{ flexShrink: 0 }}
                                    >
                                        {t('trips.actions.new_trip')}
                                    </Button>
                                )
                            : null
                    }
                >
                    {tripFilterWarehouses.length > 0 ? (
                        <FormControl size="small" sx={{ width: { xs: '100%', sm: 280 } }}>
                            <InputLabel id="trip-src-wh-filter">{t('trips.filters.destination_warehouse')}</InputLabel>
                            <Select
                                labelId="trip-src-wh-filter"
                                label={t('trips.filters.destination_warehouse')}
                                value={tripDestinationFilter}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    router.get(
                                        `${adminAppUrl}/operations/trips`,
                                        { destination_warehouse_id: v },
                                        { preserveScroll: true },
                                    );
                                }}
                            >
                                <MenuItem value="all">{t('filters.all')}</MenuItem>
                                {tripFilterWarehouses.map((w) => (
                                    <MenuItem key={w.id} value={String(w.id)}>
                                        {w.display_name || w.city}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : null}
                </PageHeader>

                {isSmUp ? (
                    <Paper sx={{ overflowX: 'auto', borderRadius: 2 }}>
                        <Table size="small" sx={{ minWidth: 520 }}>
                            <TableHead>
                                <TableRow sx={{ bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                    <TableCell>{t('trips.table.trip')}</TableCell>
                                    <TableCell>{t('trips.table.status')}</TableCell>
                                    <TableCell>{t('trips.table.vehicle')}</TableCell>
                                    <TableCell>{t('trips.table.destination_warehouse')}</TableCell>
                                    <TableCell align="right" sx={{ width: 64 }}>
                                        {t('trips.table.actions')}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                                        <TableCell sx={{ fontWeight: 600 }}>
                                            <Link
                                                href={`${adminAppUrl}/operations/trips/${row.id}`}
                                                style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                            >
                                                {row.trip_no}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.status}
                                                color={TRIP_STATUS_COLOR[row.status] ?? 'default'}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>{row.vehicle?.vehicle_no ?? '—'}</TableCell>
                                        <TableCell>{row.source_warehouse?.display_name ?? '—'}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label="Trip actions">
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {canManage ? t('trips.empty.manage') : t('trips.empty.view')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                ) : (
                    <Stack spacing={1.5}>
                        {rows.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Stack spacing={1.25}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
                                        <Link
                                            href={`${adminAppUrl}/operations/trips/${row.id}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', wordBreak: 'break-word' }}>
                                                {row.trip_no}
                                            </Typography>
                                        </Link>
                                        <Chip
                                            size="small"
                                            label={row.status}
                                            color={TRIP_STATUS_COLOR[row.status] ?? 'default'}
                                            variant="outlined"
                                            sx={{ flexShrink: 0 }}
                                        />
                                    </Stack>
                                    <Divider />
                                    <Stack spacing={0.75}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                {t('trips.labels.vehicle')}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.25 }}>
                                                {row.vehicle?.vehicle_no ?? '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                {t('trips.labels.destination_warehouse')}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
                                                {row.source_warehouse?.display_name ?? '—'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                        {rows.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {canManage ? t('trips.empty.manage_mobile') : t('trips.empty.view')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                )}

                <Menu
                    anchorEl={tableActionAnchorEl}
                    open={openTableActionMenu}
                    onClose={handleTableActionClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem onClick={() => viewTrip(selectedRow)}>{t('ui.view')}</MenuItem>
                    <MenuItem onClick={() => openManifest(selectedRow)}>{t('trips.actions.driver_manifest')}</MenuItem>
                    <MenuItem
                        onClick={() => markDeparted(selectedRow)}
                        disabled={!canManage || !(selectedRow?.status === 'PLANNED' || selectedRow?.status === 'LOADING')}
                    >
                        {t('trips.actions.mark_departed')}
                    </MenuItem>
                    <MenuItem
                        onClick={() => confirmDelivered(selectedRow)}
                        disabled={
                            !canManage ||
                            !(
                                selectedRow?.status === 'PLANNED' ||
                                selectedRow?.status === 'LOADING' ||
                                selectedRow?.status === 'DEPARTED' ||
                                selectedRow?.status === 'AT_STOP'
                            )
                        }
                    >
                        {t('trips.actions.confirm_delivery')}
                    </MenuItem>
                    <MenuItem
                        onClick={() => deleteTrip(selectedRow)}
                        disabled={!canManage || !(selectedRow?.status === 'PLANNED' || selectedRow?.status === 'CANCELLED')}
                        sx={{ color: (t) => t.palette.error.main }}
                    >
                        {t('trips.actions.delete_trip')}
                    </MenuItem>
                </Menu>
            </Stack>
        </AdminLayout>
    );
}
