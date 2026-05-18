import AdminLayout from '@/Layouts/AdminLayout';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
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

    const clearVehicleSelection = useCallback(() => {
        setVehicleId(null);
    }, []);

    const pickVehicle = useCallback((row) => {
        setVehicleId(row.id);
        setVehicleNo(row.vehicle_no ?? '');
        setCapacityWeight(row.capacity_weight != null && row.capacity_weight !== '' ? String(row.capacity_weight) : '');
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
                    clearVehicleSelection();
                }
                if (results.length > 1) {
                    clearVehicleSelection();
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
        <AdminLayout title="New trip">
            <Head title="New trip" />
            <Stack spacing={2.5}>
                {flash.error && <Alert severity="error">{flash.error}</Alert>}
                {operatingWarehouses.length === 0 && (
                    <Alert severity="warning">
                        You have no warehouse with operate access. Ask an administrator to assign you to a warehouse with Operate or Manage access.
                    </Alert>
                )}

                <Button
                    startIcon={<ArrowBackIcon />}
                    variant="text"
                    component={Link}
                    href={`${adminAppUrl}/operations/trips`}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Back to trips
                </Button>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        Trip setup
                    </Typography>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            Search by vehicle registration (like voucher merchant / product). One match fills the form; several matches — choose from the list.
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
                                    clearVehicleSelection();
                                    return;
                                }
                                setVehicleNo(value);
                            }}
                            onChange={(_, v) => {
                                if (v == null || v === '') {
                                    clearVehicleSelection();
                                    setVehicleNo('');
                                    return;
                                }
                                if (typeof v === 'string') {
                                    setVehicleNo(v);
                                    clearVehicleSelection();
                                    return;
                                }
                                pickVehicle(v);
                            }}
                            filterOptions={(opts) => opts}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Vehicle registration"
                                    placeholder="Type to search…"
                                    required
                                    error={Boolean(errors['vehicle.vehicle_no'])}
                                    helperText={
                                        errors['vehicle.vehicle_no'] ||
                                        (vehicleId
                                            ? 'Linked to an existing vehicle.'
                                            : 'New registration will create a vehicle when you submit.')
                                    }
                                />
                            )}
                        />

                        <TextField
                            label="Capacity weight"
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
                            <InputLabel id="dest-wh-label">Destination warehouse</InputLabel>
                            <Select
                                labelId="dest-wh-label"
                                label="Destination warehouse"
                                value={destinationWarehouseId}
                                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                            >
                                <MenuItem value="">
                                    <em>Select…</em>
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
                                label="Driver name"
                                size="small"
                                fullWidth
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                            />
                            <TextField
                                label="Driver phone"
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
                        Create trip
                    </Button>
                </Stack>
            </Stack>
        </AdminLayout>
    );
}
