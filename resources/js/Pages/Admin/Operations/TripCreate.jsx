import AdminLayout from '@/Layouts/AdminLayout';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    FormControl,
    FormHelperText,
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
                if (results.length === 1) {
                    pickVehicle(results[0]);
                }
                if (results.length === 0) {
                    clearVehicleSelection(true);
                }
                if (results.length > 1) {
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
            <Stack spacing={2.5}>
                {flash.error && <Alert severity="error">{flash.error}</Alert>}
                {operatingWarehouses.length === 0 && (
                    <Alert severity="warning">
                        {t('trip_create.no_operate_access_warning')}
                    </Alert>
                )}

                <Button
                    startIcon={<ArrowBackIcon />}
                    variant="text"
                    component={Link}
                    href={`${adminAppUrl}/operations/trips`}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    {t('trip_detail.back_to_trips')}
                </Button>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        {t('trip_create.setup_title')}
                    </Typography>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {t('trip_create.setup_subtitle')}
                        </Typography>

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

                        <TextField
                            label={t('trip_create.fields.capacity_weight')}
                            size="small"
                            fullWidth
                            type="number"
                            inputProps={{ step: '1', min: '0' }}
                            value={capacityWeight}
                            onChange={(e) => setCapacityWeight(e.target.value)}
                            error={Boolean(errors['vehicle.capacity_weight'])}
                            helperText={errors['vehicle.capacity_weight']}
                        />

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
                            {errors.destination_warehouse_id ? <FormHelperText>{errors.destination_warehouse_id}</FormHelperText> : null}
                        </FormControl>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label={t('trip_detail.labels.driver')}
                                size="small"
                                fullWidth
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                            />
                            <TextField
                                label={t('trip_create.fields.driver_phone')}
                                size="small"
                                fullWidth
                                value={driverPhone}
                                onChange={(e) => setDriverPhone(e.target.value)}
                            />
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
