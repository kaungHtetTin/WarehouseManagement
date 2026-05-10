import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Fab,
    FormControl,
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
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useMemo } from 'react';

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
    const pageProps = usePage().props;
    const {
        trips = [],
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
        trip_source_filter: tripSourceFilter = 'all',
        trip_filter_warehouses: tripFilterWarehouses = [],
    } = pageProps;
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('trips.manage');

    const rows = useMemo(() => trips ?? [], [trips]);

    return (
        <AdminLayout title="Trips">
            <Head title="Trips" />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ width: '100%' }}
                >
                    <Box sx={{ flex: '1 1 auto', minWidth: 0, pt: { sm: 0.25 } }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Trips
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Plan routes with vehicle and delivery stops. Cargo loads from confirmed vouchers on each trip&apos;s detail page.
                        </Typography>
                        {tripFilterWarehouses.length > 0 && (
                            <FormControl size="small" sx={{ mt: 1.5, width: { xs: '100%', sm: 280 } }}>
                                <InputLabel id="trip-src-wh-filter">Source warehouse</InputLabel>
                                <Select
                                    labelId="trip-src-wh-filter"
                                    label="Source warehouse"
                                    value={tripSourceFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        router.get(
                                            `${adminAppUrl}/operations/trips`,
                                            { source_warehouse_id: v },
                                            { preserveScroll: true },
                                        );
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {tripFilterWarehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.code} · {w.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                    {canManage &&
                        (isSmUp ? (
                            <Fab
                                component={Link}
                                href={`${adminAppUrl}/operations/trips/create`}
                                size="small"
                                color="primary"
                                aria-label="Create trip"
                                sx={{ flexShrink: 0, boxShadow: 2 }}
                            >
                                <AddIcon fontSize="small" />
                            </Fab>
                        ) : (
                            <Button
                                component={Link}
                                href={`${adminAppUrl}/operations/trips/create`}
                                variant="contained"
                                startIcon={<AddIcon />}
                                fullWidth
                                sx={{ flexShrink: 0 }}
                            >
                                New trip
                            </Button>
                        ))}
                </Stack>

                {isSmUp ? (
                    <Paper sx={{ overflowX: 'auto', borderRadius: 2 }}>
                        <Table size="small" sx={{ minWidth: 520 }}>
                            <TableHead>
                                <TableRow sx={{ bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50') }}>
                                    <TableCell>Trip</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Vehicle</TableCell>
                                    <TableCell>Source warehouse</TableCell>
                                    <TableCell align="right">Stops</TableCell>
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
                                        <TableCell>{row.source_warehouse?.name ?? '—'}</TableCell>
                                        <TableCell align="right">{row.stops_count ?? 0}</TableCell>
                                    </TableRow>
                                ))}
                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                No trips yet.{canManage ? ' Create one to assign a vehicle and stops.' : ''}
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
                                                Vehicle
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.25 }}>
                                                {row.vehicle?.vehicle_no ?? '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                Source warehouse
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
                                                {row.source_warehouse?.name ?? '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                Stops
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.25 }}>
                                                {row.stops_count ?? 0}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                        {rows.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    No trips yet.{canManage ? ' Tap New trip above to assign a vehicle and stops.' : ''}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                )}
            </Stack>
        </AdminLayout>
    );
}
