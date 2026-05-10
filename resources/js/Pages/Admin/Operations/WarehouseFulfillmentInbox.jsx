import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
    TableContainer,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';

function remainingQty(row) {
    return Math.max(0, Number(row.qty_received ?? 0) - Number(row.qty_dispatched ?? 0));
}

export default function WarehouseFulfillmentInbox() {
    const {
        instructions = [],
        warehouses = [],
        flash = {},
        admin_app_url: adminAppUrl,
        errors = {},
        fulfillment_warehouse_filter: fulfillmentWarehouseFilter = 'all',
    } = usePage().props;
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
    const [dialog, setDialog] = useState(null);
    const form = useForm({
        action_type: 'OWNER_PICKUP',
        qty: '',
        next_warehouse_id: '',
        note: '',
    });

    const openDialog = (row) => {
        form.setData({
            action_type: 'OWNER_PICKUP',
            qty: remainingQty(row).toFixed(3),
            next_warehouse_id: '',
            note: '',
        });
        form.clearErrors();
        setDialog(row);
    };

    const allWarehouses = useMemo(() => {
        if (warehouses?.length) {
            return warehouses;
        }
        const map = new Map();
        instructions.forEach((r) => {
            if (r.warehouse) map.set(r.warehouse.id, r.warehouse);
            if (r.next_warehouse) map.set(r.next_warehouse.id, r.next_warehouse);
        });
        return Array.from(map.values());
    }, [instructions, warehouses]);

    return (
        <AdminLayout title="Warehouse Fulfillment Inbox">
            <Head title="Warehouse Fulfillment Inbox" />
            <Stack spacing={2.5}>
                {flash.success ? <Alert severity="success">{flash.success}</Alert> : null}
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Warehouse Fulfillment Inbox
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1.5 }}>
                        Goods already received at destination warehouses. Process owner pickup, direct delivery, or forward to another warehouse.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1.5 }}>
                        <FormControl size="small" sx={{ width: { xs: '100%', sm: 300 } }}>
                            <InputLabel id="fulfillment-wh-filter">Warehouse</InputLabel>
                            <Select
                                labelId="fulfillment-wh-filter"
                                label="Warehouse"
                                value={fulfillmentWarehouseFilter}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    router.get(
                                        `${adminAppUrl}/operations/fulfillment/inbox`,
                                        { warehouse_id: v },
                                        { preserveScroll: true },
                                    );
                                }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                {warehouses.map((w) => (
                                    <MenuItem key={w.id} value={String(w.id)}>
                                        {w.code} · {w.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    {instructions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No pending fulfillment instructions.
                        </Typography>
                    ) : (
                        isMdUp ? (
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ minWidth: 920 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Warehouse</TableCell>
                                        <TableCell>Voucher</TableCell>
                                        <TableCell>Merchant</TableCell>
                                        <TableCell>Product</TableCell>
                                        <TableCell align="right">Received</TableCell>
                                        <TableCell align="right">Dispatched</TableCell>
                                        <TableCell align="right">Remaining</TableCell>
                                        <TableCell>Payment</TableCell>
                                        <TableCell align="right" />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {instructions.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>{row.warehouse ? `${row.warehouse.code} · ${row.warehouse.name}` : '—'}</TableCell>
                                            <TableCell>
                                                <Stack spacing={0.25}>
                                                    <Typography variant="body2">
                                                        <Link href={`${adminAppUrl}/operations/vouchers/${row.voucher_item?.voucher?.id}`}>
                                                            {row.voucher_item?.voucher?.voucher_no ?? '—'}
                                                        </Link>
                                                        {row.voucher_item?.line_no ? ` · L${row.voucher_item.line_no}` : ''}
                                                    </Typography>
                                                    {row.trip_item?.trip?.id ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            <Link href={`${adminAppUrl}/operations/trips/${row.trip_item.trip.id}`}>
                                                                {row.trip_item.trip.trip_no ?? 'Trip'}
                                                            </Link>
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>{row.merchant?.name ?? '—'}</TableCell>
                                            <TableCell>{row.voucher_item?.product?.name ?? '—'}</TableCell>
                                            <TableCell align="right">{row.qty_received}</TableCell>
                                            <TableCell align="right">{row.qty_dispatched}</TableCell>
                                            <TableCell align="right">{remainingQty(row).toFixed(3)}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={row.voucher_item?.payment_status ?? row.voucher_item?.voucher?.payment_status ?? 'UNPAID'}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button size="small" variant="outlined" onClick={() => openDialog(row)}>
                                                    Process
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Stack spacing={1.25}>
                                {instructions.map((row) => (
                                    <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                        <Stack spacing={1}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    {row.voucher_item?.product?.name ?? '—'}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={row.voucher_item?.payment_status ?? row.voucher_item?.voucher?.payment_status ?? 'UNPAID'}
                                                    variant="outlined"
                                                />
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary">
                                                {row.warehouse ? `${row.warehouse.code} · ${row.warehouse.name}` : '—'}
                                            </Typography>
                                            <Typography variant="body2">
                                                <Link href={`${adminAppUrl}/operations/vouchers/${row.voucher_item?.voucher?.id}`}>
                                                    {row.voucher_item?.voucher?.voucher_no ?? '—'}
                                                </Link>
                                                {row.voucher_item?.line_no ? ` · L${row.voucher_item.line_no}` : ''}
                                            </Typography>
                                            {row.trip_item?.trip?.id ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    Trip:{' '}
                                                    <Link href={`${adminAppUrl}/operations/trips/${row.trip_item.trip.id}`}>
                                                        {row.trip_item.trip.trip_no ?? 'Trip'}
                                                    </Link>
                                                </Typography>
                                            ) : null}
                                            <Typography variant="body2" color="text.secondary">
                                                Merchant: {row.merchant?.name ?? '—'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                Destination note: {row.note ?? '—'}
                                            </Typography>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    Received {row.qty_received} · Dispatched {row.qty_dispatched} · Remaining {remainingQty(row).toFixed(3)}
                                                </Typography>
                                            </Box>
                                            <Button size="small" variant="outlined" fullWidth onClick={() => openDialog(row)}>
                                                Process
                                            </Button>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )
                    )}
                </Paper>
                <Dialog open={Boolean(dialog)} onClose={() => !form.processing && setDialog(null)} fullWidth maxWidth="sm">
                    <DialogTitle>Process fulfillment</DialogTitle>
                    <DialogContent>
                        {dialog ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Remaining: {remainingQty(dialog).toFixed(3)} {dialog.voucher_item?.product?.unit ?? dialog.voucher_item?.unit ?? ''}
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="wf-action">Action</InputLabel>
                                    <Select
                                        labelId="wf-action"
                                        label="Action"
                                        value={form.data.action_type}
                                        onChange={(e) => form.setData('action_type', e.target.value)}
                                    >
                                        <MenuItem value="OWNER_PICKUP">Owner pickup</MenuItem>
                                        <MenuItem value="DIRECT_DELIVERY">Direct delivery</MenuItem>
                                        <MenuItem value="FORWARD_TO_WAREHOUSE">Forward to warehouse</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    label="Quantity"
                                    type="number"
                                    inputProps={{ step: '0.001', min: '0.001', max: remainingQty(dialog).toFixed(3) }}
                                    value={form.data.qty}
                                    onChange={(e) => form.setData('qty', e.target.value)}
                                    error={Boolean(errors.qty || form.errors.qty)}
                                    helperText={errors.qty || form.errors.qty}
                                />
                                {form.data.action_type === 'FORWARD_TO_WAREHOUSE' ? (
                                    <FormControl fullWidth size="small" error={Boolean(errors.next_warehouse_id || form.errors.next_warehouse_id)}>
                                        <InputLabel id="wf-next-wh">Next warehouse</InputLabel>
                                        <Select
                                            labelId="wf-next-wh"
                                            label="Next warehouse"
                                            value={form.data.next_warehouse_id}
                                            onChange={(e) => form.setData('next_warehouse_id', e.target.value)}
                                            error={Boolean(errors.next_warehouse_id || form.errors.next_warehouse_id)}
                                        >
                                            {allWarehouses
                                                .filter((w) => Number(w.id) !== Number(dialog.warehouse_id))
                                                .map((w) => (
                                                    <MenuItem key={w.id} value={String(w.id)}>
                                                        {w.code} · {w.name}
                                                    </MenuItem>
                                                ))}
                                        </Select>
                                        {(errors.next_warehouse_id || form.errors.next_warehouse_id) ? (
                                            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                                                {errors.next_warehouse_id || form.errors.next_warehouse_id}
                                            </Typography>
                                        ) : null}
                                    </FormControl>
                                ) : null}
                                <TextField
                                    size="small"
                                    label="Note (optional)"
                                    multiline
                                    minRows={2}
                                    value={form.data.note}
                                    onChange={(e) => form.setData('note', e.target.value)}
                                />
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialog(null)} disabled={form.processing}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            disabled={form.processing || !dialog}
                            onClick={() => {
                                if (!dialog) return;
                                form.post(`${adminAppUrl}/operations/fulfillment/instructions/${dialog.id}/dispatch`, {
                                    preserveScroll: true,
                                    onSuccess: () => setDialog(null),
                                });
                            }}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </Stack>
        </AdminLayout>
    );
}

