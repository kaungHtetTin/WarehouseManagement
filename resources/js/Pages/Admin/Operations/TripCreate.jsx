import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    FormControl,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SECTION_CARD_SX = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 1.5,
    boxShadow: 'none',
};

export default function TripCreate() {
    const {
        operatingWarehouses = [],
        routingWarehouses = [],
        defaultDestinationWarehouseId = null,
        admin_app_url: adminAppUrl,
        flash = {},
        errors = {},
    } = usePage().props;
    const t = useT();
    const [processing, setProcessing] = useState(false);

    const [vehicleId, setVehicleId] = useState(null);
    const [vehicleNo, setVehicleNo] = useState('');
    const [capacityWeight, setCapacityWeight] = useState('');
    const [vehicleOptions, setVehicleOptions] = useState([]);

    const [destinationWarehouseId, setDestinationWarehouseId] = useState(
        () => (defaultDestinationWarehouseId != null ? String(defaultDestinationWarehouseId) : ''),
    );
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');

    const vehicleDebounceRef = useRef(null);
    const lastVehicleAutofillRef = useRef(null);

    const clearVehicleSelection = useCallback((resetAutofill = false) => {
        setVehicleId(null);
        if (!resetAutofill) {
            return;
        }

        const last = lastVehicleAutofillRef.current;
        if (!last) {
            return;
        }

        if (capacityWeight === last.capacity_weight) {
            setCapacityWeight('');
        }
        if (driverName === last.driver_name) {
            setDriverName('');
        }
        if (driverPhone === last.driver_phone) {
            setDriverPhone('');
        }
        lastVehicleAutofillRef.current = null;
    }, [capacityWeight, driverName, driverPhone]);

    const pickVehicle = useCallback((row) => {
        setVehicleId(row.id);
        setVehicleNo(row.vehicle_no ?? '');
        setCapacityWeight(row.capacity_weight != null && row.capacity_weight !== '' ? String(row.capacity_weight) : '');
        setDriverName(row.driver_name ?? '');
        setDriverPhone(row.driver_phone ?? '');
        lastVehicleAutofillRef.current = {
            vehicle_id: row.id ?? null,
            capacity_weight: row.capacity_weight != null && row.capacity_weight !== '' ? String(row.capacity_weight) : '',
            driver_name: row.driver_name ?? '',
            driver_phone: row.driver_phone ?? '',
        };
    }, []);

    const vehicleAutocompleteValue = useMemo(() => {
        if (vehicleId != null) {
            const found = vehicleOptions.find((o) => Number(o.id) === Number(vehicleId));
            if (found) {
                return found;
            }
            return {
                id: vehicleId,
                vehicle_no: vehicleNo,
                capacity_weight: capacityWeight === '' ? null : capacityWeight,
                status: 'ACTIVE',
            };
        }
        return vehicleNo === '' ? null : vehicleNo;
    }, [vehicleId, vehicleOptions, vehicleNo, capacityWeight]);

    const selectedDestination = useMemo(
        () => routingWarehouses.find((w) => String(w.id) === String(destinationWarehouseId)) ?? null,
        [routingWarehouses, destinationWarehouseId],
    );

    const summaryCards = [
        {
            label: 'Vehicle',
            value: vehicleNo.trim() || 'Not selected',
            helper: vehicleId ? 'Linked to existing vehicle record' : 'New vehicle details will be saved',
            tone: vehicleNo.trim() ? 'primary.main' : 'text.primary',
        },
        {
            label: 'Capacity',
            value: capacityWeight ? `${capacityWeight}` : '—',
            helper: 'Vehicle max weight',
            tone: capacityWeight ? 'text.primary' : 'text.secondary',
        },
        {
            label: 'Destination',
            value: selectedDestination?.display_name ?? selectedDestination?.city ?? 'Not selected',
            helper: selectedDestination ? 'Routing warehouse selected' : 'Choose where this trip is heading',
            tone: selectedDestination ? 'text.primary' : 'text.secondary',
        },
        {
            label: 'Driver',
            value: driverName.trim() || 'Not assigned',
            helper: driverPhone.trim() || 'Phone not added yet',
            tone: driverName.trim() ? 'text.primary' : 'text.secondary',
        },
    ];

    const readinessItems = [
        { label: 'Vehicle registration', done: vehicleNo.trim().length > 0 },
        { label: 'Destination warehouse', done: Boolean(destinationWarehouseId) },
        { label: 'Driver assigned', done: driverName.trim().length > 0 },
    ];

    const getVehicleOptionLabel = (option) => {
        if (typeof option === 'string') {
            return option;
        }
        if (!option?.vehicle_no) {
            return '';
        }
        return `${option.vehicle_no} (${option.vehicle_type})`;
    };

    useEffect(() => {
        const q = vehicleNo.trim();
        if (q.length < 1) {
            setVehicleOptions([]);
            return;
        }
        window.clearTimeout(vehicleDebounceRef.current);
        vehicleDebounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await axios.get(`${adminAppUrl}/operations/trips/wizard/vehicle-search`, {
                    params: { q },
                    headers: { Accept: 'application/json' },
                });
                const results = data.results || [];
                setVehicleOptions(results);
                if (results.length === 0) {
                    clearVehicleSelection(true);
                }
            } catch {
                setVehicleOptions([]);
            }
        }, 350);
        return () => window.clearTimeout(vehicleDebounceRef.current);
    }, [vehicleNo, adminAppUrl, pickVehicle, clearVehicleSelection]);

    const submit = () => {
        setProcessing(true);
        const parseOpt = (v) => {
            if (v === '' || v == null) return null;
            const n = Number.parseFloat(String(v));
            return Number.isFinite(n) ? n : null;
        };

        router.post(
            `${adminAppUrl}/operations/trips`,
            {
                vehicle_id: vehicleId,
                vehicle: {
                    vehicle_no: vehicleNo.trim(),
                    capacity_weight: parseOpt(capacityWeight),
                },
                destination_warehouse_id: destinationWarehouseId ? Number(destinationWarehouseId) : null,
                driver_name: driverName.trim() || null,
                driver_phone: driverPhone.trim() || null,
            },
            {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AdminLayout title={t('trips.actions.new_trip')}>
            <Head title={t('trips.actions.new_trip')} />
            <Stack spacing={2}>
                {flash.error && <Alert severity="error">{flash.error}</Alert>}
                {operatingWarehouses.length === 0 && (
                    <Alert severity="warning">
                        {t('trip_create.no_operate_access_warning')}
                    </Alert>
                )}

                <PageHeader
                    eyebrow="Trip Setup"
                    title={t('trip_create.actions.create_trip')}
                    subtitle={t('trip_create.setup_subtitle')}
                    actions={
                        <Button
                            startIcon={<ArrowBackIcon />}
                            variant="text"
                            component={Link}
                            href={`${adminAppUrl}/operations/trips`}
                            size="small"
                        >
                            {t('trip_detail.back_to_trips')}
                        </Button>
                    }
                >
                    <Grid container spacing={1.5}>
                        {summaryCards.map((item) => (
                            <Grid key={item.label} item xs={12} sm={6} lg={3}>
                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, boxShadow: 'none', height: '100%' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {item.label}
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 800, color: item.tone }}>
                                        {item.value}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                                        {item.helper}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </PageHeader>

                <Paper variant="outlined" sx={SECTION_CARD_SX}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {t('trip_create.setup_title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Configure the trip basics first, then load vouchers from the trip detail page.
                            </Typography>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.default', boxShadow: 'none' }}>
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    Setup checklist
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                    {readinessItems.map((item) => (
                                        <Chip
                                            key={item.label}
                                            size="small"
                                            label={item.label}
                                            color={item.done ? 'success' : 'default'}
                                            variant="outlined"
                                        />
                                    ))}
                                </Stack>
                            </Stack>
                        </Paper>

                        <Stack spacing={2}>
                        <Autocomplete
                            freeSolo
                            size="small"
                            options={vehicleOptions}
                            getOptionLabel={getVehicleOptionLabel}
                            value={vehicleAutocompleteValue}
                            inputValue={vehicleNo}
                            isOptionEqualToValue={(option, val) => {
                                if (val == null || option == null) {
                                    return false;
                                }
                                if (typeof val === 'string' || typeof option === 'string') {
                                    return false;
                                }
                                return Number(option.id) === Number(val.id);
                            }}
                            onInputChange={(_, value, reason) => {
                                if (reason === 'reset') {
                                    return;
                                }
                                if (reason === 'clear') {
                                    setVehicleNo('');
                                    clearVehicleSelection(true);
                                    return;
                                }
                                if (vehicleId != null) {
                                    clearVehicleSelection(true);
                                }
                                setVehicleNo(value);
                            }}
                            onChange={(_, v) => {
                                if (v == null || v === '') {
                                    clearVehicleSelection(true);
                                    setVehicleNo('');
                                    return;
                                }
                                if (typeof v === 'string') {
                                    setVehicleNo(v);
                                    clearVehicleSelection(true);
                                    return;
                                }
                                pickVehicle(v);
                            }}
                            filterOptions={(opts) => opts}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('trip_create.fields.vehicle_registration')}
                                    placeholder={t('trip_create.fields.search_placeholder')}
                                    required
                                    error={Boolean(errors['vehicle.vehicle_no'])}
                                    helperText={
                                        errors['vehicle.vehicle_no'] ||
                                        (vehicleId
                                            ? t('trip_create.vehicle_linked_hint')
                                            : t('trip_create.vehicle_create_hint'))
                                    }
                                />
                            )}
                        />

                            {vehicleOptions.length > 0 && vehicleId == null && (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 1.5,
                                        bgcolor: 'action.hover',
                                        borderColor: 'primary.light',
                                    }}
                                >
                                    <Stack spacing={1.25}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                            Recommended vehicles
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Select one to auto-fill capacity, driver details
                                        </Typography>
                                        <Stack spacing={1}>
                                            {vehicleOptions.map((opt) => (
                                                <Box
                                                    key={opt.id}
                                                    sx={{
                                                        display: 'flex',
                                                        flexDirection: { xs: 'column', sm: 'row' },
                                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                                        justifyContent: 'space-between',
                                                        gap: 1,
                                                        p: 1,
                                                        borderRadius: 1,
                                                        bgcolor: 'background.paper',
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {opt.vehicle_no} ({opt.vehicle_type || '—'})
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Capacity: {opt.capacity_weight ?? '—'} • Driver: {opt.driver_name || '—'} {opt.driver_phone ? `(${opt.driver_phone})` : ''}
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => pickVehicle(opt)}
                                                        sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                                                    >
                                                        Use this
                                                    </Button>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Stack>
                                </Paper>
                            )}

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label={t('trip_create.fields.capacity_weight')}
                                        size="small"
                                        fullWidth
                                        type="number"
                                        inputProps={{ step: '1', min: '0' }}
                                        value={capacityWeight}
                                        onChange={(e) => setCapacityWeight(e.target.value)}
                                        error={Boolean(errors['vehicle.capacity_weight'])}
                                        helperText={errors['vehicle.capacity_weight'] || 'Use a recommendation above to fill, or enter manually.'}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small" required error={Boolean(errors.destination_warehouse_id)}>
                                        <InputLabel id="dest-wh-label">{t('trips.labels.destination_warehouse')}</InputLabel>
                                        <Select
                                            labelId="dest-wh-label"
                                            label={t('trips.labels.destination_warehouse')}
                                            value={destinationWarehouseId}
                                            onChange={(e) => setDestinationWarehouseId(e.target.value)}
                                        >
                                            <MenuItem value="">
                                                <em>{t('ui.select')}</em>
                                            </MenuItem>
                                            {routingWarehouses.map((w) => (
                                                <MenuItem key={w.id} value={String(w.id)}>
                                                    {w.display_name || w.city}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        {errors.destination_warehouse_id ? (
                                            <FormHelperText>{errors.destination_warehouse_id}</FormHelperText>
                                        ) : (
                                            <FormHelperText>Select the warehouse this trip will serve first.</FormHelperText>
                                        )}
                                    </FormControl>
                                </Grid>
                            </Grid>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label={t('trip_detail.labels.driver')}
                                    size="small"
                                    fullWidth
                                    value={driverName}
                                    onChange={(e) => setDriverName(e.target.value)}
                                    helperText="Assign a driver now or update it later from trip detail."
                                />
                                <TextField
                                    label={t('trip_create.fields.driver_phone')}
                                    size="small"
                                    fullWidth
                                    value={driverPhone}
                                    onChange={(e) => setDriverPhone(e.target.value)}
                                    helperText="Used for dispatch coordination and trip follow-up."
                                />
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Stack direction="row" spacing={1} justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
                    <Button
                        variant="contained"
                        disabled={processing || operatingWarehouses.length === 0}
                        onClick={submit}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        {t('trip_create.actions.create_trip')}
                    </Button>
                </Stack>
            </Stack>
        </AdminLayout>
    );
}
