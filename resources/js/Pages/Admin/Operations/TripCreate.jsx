import AdminLayout from '@/Layouts/AdminLayout';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Divider,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { AddCircleOutlineOutlined as AddCircleOutlineIcon, ArrowBack as ArrowBackIcon, DeleteOutlineOutlined as DeleteOutlineIcon } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const emptyStop = () => ({
    warehouse_id: '',
    location_name: '',
    city: '',
    address: '',
});

export default function TripCreate() {
    const {
        operatingWarehouses = [],
        routingWarehouses = [],
        defaultSourceWarehouseId = null,
        admin_app_url: adminAppUrl,
        flash = {},
        errors = {},
    } = usePage().props;
    const [processing, setProcessing] = useState(false);

    const [vehicleId, setVehicleId] = useState(null);
    const [vehicleNo, setVehicleNo] = useState('');
    const [vehicleType, setVehicleType] = useState('');
    const [vehicleWarehouseId, setVehicleWarehouseId] = useState('');
    const [capacityWeight, setCapacityWeight] = useState('');
    const [capacityVolume, setCapacityVolume] = useState('');
    const [vehicleOptions, setVehicleOptions] = useState([]);

    const [sourceWarehouseId, setSourceWarehouseId] = useState(
        () => (defaultSourceWarehouseId != null ? String(defaultSourceWarehouseId) : ''),
    );
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [stops, setStops] = useState([emptyStop()]);

    const vehicleDebounceRef = useRef(null);

    const clearVehicleSelection = useCallback(() => {
        setVehicleId(null);
    }, []);

    const pickVehicle = useCallback((row) => {
        setVehicleId(row.id);
        setVehicleNo(row.vehicle_no ?? '');
        setVehicleType(row.vehicle_type ?? '');
        setVehicleWarehouseId(row.warehouse_id != null ? String(row.warehouse_id) : '');
        setCapacityWeight(row.capacity_weight != null && row.capacity_weight !== '' ? String(row.capacity_weight) : '');
        setCapacityVolume(row.capacity_volume != null && row.capacity_volume !== '' ? String(row.capacity_volume) : '');
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
                vehicle_type: vehicleType,
                warehouse_id: vehicleWarehouseId === '' ? null : Number(vehicleWarehouseId),
                capacity_weight: capacityWeight === '' ? null : capacityWeight,
                capacity_volume: capacityVolume === '' ? null : capacityVolume,
                status: 'ACTIVE',
            };
        }
        return vehicleNo === '' ? null : vehicleNo;
    }, [vehicleId, vehicleOptions, vehicleNo, vehicleType, vehicleWarehouseId, capacityWeight, capacityVolume]);

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

    const addStop = () => setStops((prev) => [...prev, emptyStop()]);
    const removeStop = (index) => setStops((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

    const updateStop = (index, patch) => {
        setStops((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    };

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
                    vehicle_type: vehicleType.trim(),
                    warehouse_id: vehicleWarehouseId ? Number(vehicleWarehouseId) : null,
                    capacity_weight: parseOpt(capacityWeight),
                    capacity_volume: parseOpt(capacityVolume),
                },
                source_warehouse_id: sourceWarehouseId ? Number(sourceWarehouseId) : null,
                driver_name: driverName.trim() || null,
                driver_phone: driverPhone.trim() || null,
                stops: stops.map((s) => ({
                    warehouse_id: s.warehouse_id ? Number(s.warehouse_id) : null,
                    location_name: s.location_name?.trim() || null,
                    city: s.city?.trim() || null,
                    address: s.address?.trim() || null,
                })),
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
                {errors.stops && typeof errors.stops === 'string' && <Alert severity="warning">{errors.stops}</Alert>}
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
                            Search by vehicle registration (like voucher merchant / product). One match fills the form; several matches — choose from the list;
                            no match saves a new vehicle when you create the trip.
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
                                            ? 'Linked to an existing vehicle — you can still edit details below.'
                                            : 'New registration will create a vehicle when you submit.')
                                    }
                                />
                            )}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Vehicle type"
                                size="small"
                                fullWidth
                                required
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                                error={Boolean(errors['vehicle.vehicle_type'])}
                                helperText={errors['vehicle.vehicle_type']}
                            />
                            <FormControl fullWidth size="small" error={Boolean(errors['vehicle.warehouse_id'])}>
                                <InputLabel id="veh-wh-label">Vehicle home warehouse</InputLabel>
                                <Select
                                    labelId="veh-wh-label"
                                    label="Vehicle home warehouse"
                                    value={vehicleWarehouseId}
                                    onChange={(e) => setVehicleWarehouseId(e.target.value)}
                                >
                                    <MenuItem value="">
                                        <em>None</em>
                                    </MenuItem>
                                    {routingWarehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.code} · {w.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {errors['vehicle.warehouse_id'] ? (
                                    <FormHelperText>{errors['vehicle.warehouse_id']}</FormHelperText>
                                ) : (
                                    <FormHelperText sx={{ mx: 0 }}>Optional — same as Master → Vehicles.</FormHelperText>
                                )}
                            </FormControl>
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Capacity weight"
                                size="small"
                                fullWidth
                                type="number"
                                inputProps={{ step: '0.001', min: '0' }}
                                value={capacityWeight}
                                onChange={(e) => setCapacityWeight(e.target.value)}
                                error={Boolean(errors['vehicle.capacity_weight'])}
                                helperText={errors['vehicle.capacity_weight']}
                            />
                            <TextField
                                label="Capacity volume"
                                size="small"
                                fullWidth
                                type="number"
                                inputProps={{ step: '0.001', min: '0' }}
                                value={capacityVolume}
                                onChange={(e) => setCapacityVolume(e.target.value)}
                                error={Boolean(errors['vehicle.capacity_volume'])}
                                helperText={errors['vehicle.capacity_volume']}
                            />
                        </Stack>

                        <FormControl fullWidth size="small" required error={Boolean(errors.source_warehouse_id)}>
                            <InputLabel id="src-wh-label">Source warehouse</InputLabel>
                            <Select
                                labelId="src-wh-label"
                                label="Source warehouse"
                                value={sourceWarehouseId}
                                onChange={(e) => setSourceWarehouseId(e.target.value)}
                            >
                                <MenuItem value="">
                                    <em>Select…</em>
                                </MenuItem>
                                {operatingWarehouses.map((w) => (
                                    <MenuItem key={w.id} value={String(w.id)}>
                                        {w.name} ({w.code})
                                    </MenuItem>
                                ))}
                            </Select>
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

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                        spacing={1.5}
                        sx={{ mb: 2, width: '100%' }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700, flex: '1 1 auto', minWidth: 0, pt: { sm: 0.25 } }}>
                            Stops (order = delivery sequence)
                        </Typography>
                        <Button
                            size="small"
                            startIcon={<AddCircleOutlineIcon />}
                            onClick={addStop}
                            sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' }, ml: { sm: 'auto' } }}
                        >
                            Add stop
                        </Button>
                    </Stack>
                    <Stack spacing={2}>
                        {stops.map((stop, index) => (
                            <Box key={index}>
                                {index > 0 && <Divider sx={{ mb: 2 }} />}
                                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={1}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minWidth: { sm: 56 } }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mt: { sm: 1 } }}>
                                            Stop {index + 1}
                                        </Typography>
                                        <IconButton
                                            aria-label="Remove stop"
                                            size="small"
                                            onClick={() => removeStop(index)}
                                            disabled={stops.length <= 1}
                                            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel id={`wh-stop-${index}`}>Warehouse (optional)</InputLabel>
                                            <Select
                                                labelId={`wh-stop-${index}`}
                                                label="Warehouse (optional)"
                                                value={stop.warehouse_id}
                                                onChange={(e) => updateStop(index, { warehouse_id: e.target.value })}
                                            >
                                                <MenuItem value="">
                                                    <em>—</em>
                                                </MenuItem>
                                                {routingWarehouses.map((w) => (
                                                    <MenuItem key={w.id} value={String(w.id)}>
                                                        {w.code} · {w.name}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            label="Location name"
                                            size="small"
                                            fullWidth
                                            value={stop.location_name}
                                            onChange={(e) => updateStop(index, { location_name: e.target.value })}
                                            error={Boolean(errors[`stops.${index}`] ?? errors[`stops.${index}.warehouse_id`])}
                                            helperText={errors[`stops.${index}`] ?? errors[`stops.${index}.warehouse_id`]}
                                        />
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                            <TextField
                                                label="City"
                                                size="small"
                                                fullWidth
                                                value={stop.city}
                                                onChange={(e) => updateStop(index, { city: e.target.value })}
                                            />
                                            <TextField
                                                label="Address"
                                                size="small"
                                                fullWidth
                                                value={stop.address}
                                                onChange={(e) => updateStop(index, { address: e.target.value })}
                                                multiline
                                                minRows={2}
                                            />
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            Provide a warehouse <strong>or</strong> location / city / address for this stop.
                                        </Typography>
                                    </Stack>
                                    <IconButton
                                        aria-label="Remove stop"
                                        size="small"
                                        onClick={() => removeStop(index)}
                                        disabled={stops.length <= 1}
                                        sx={{ mt: 0.5, display: { xs: 'none', sm: 'inline-flex' } }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Box>
                        ))}
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
