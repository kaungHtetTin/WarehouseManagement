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
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useState } from 'react';

const initialAdjust = {
    product_id: '',
    qty: '',
    note: '',
};

export default function WarehouseStocksIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const {
        warehouses = [],
        selectedWarehouseId = null,
        stocks = [],
        products = [],
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
    } = usePage().props;
    const canAdjust = (auth?.permission_codes ?? []).includes('inventory.manage');
    const [adjustOpen, setAdjustOpen] = useState(false);
    const [adjustForm, setAdjustForm] = useState(initialAdjust);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    const changeWarehouse = (warehouseId) => {
        router.get(
            `${adminAppUrl}/inventory/stocks`,
            { warehouse_id: warehouseId },
            { preserveScroll: true, preserveState: true },
        );
    };

    const openAdjust = () => {
        setAdjustForm(initialAdjust);
        setError('');
        setAdjustOpen(true);
    };

    const closeAdjust = () => {
        if (!processing) {
            setAdjustOpen(false);
            setAdjustForm(initialAdjust);
            setError('');
        }
    };

    const submitAdjust = () => {
        if (!selectedWarehouseId) {
            setError('Select a warehouse first.');
            return;
        }
        setProcessing(true);
        setError('');
        router.post(
            `${adminAppUrl}/inventory/stock-adjustments`,
            {
                warehouse_id: selectedWarehouseId,
                product_id: adjustForm.product_id,
                qty: adjustForm.qty,
                note: adjustForm.note || null,
            },
            {
                preserveScroll: true,
                onError: (errs) => {
                    const first = errs?.qty || errs?.product_id || errs?.warehouse_id;
                    setError(typeof first === 'string' ? first : 'Unable to apply adjustment.');
                },
                onFinish: () => setProcessing(false),
                onSuccess: closeAdjust,
            },
        );
    };

    return (
        <AdminLayout title="Stock by warehouse">
            <Head title="Stock" />
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
                            Stock
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            On-hand balances per warehouse. Use adjustments to correct counts (creates an audit movement).
                        </Typography>
                    </Box>
                    {canAdjust && warehouses.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-end', md: 'auto' } }}>
                            <Fab size="small" color="primary" onClick={openAdjust} aria-label="Stock adjustment" sx={{ boxShadow: 2 }}>
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Stack>
                    )}
                </Stack>

                <FormControl fullWidth sx={{ maxWidth: { md: 360 } }}>
                    <InputLabel>Warehouse</InputLabel>
                    <Select
                        label="Warehouse"
                        value={selectedWarehouseId ?? ''}
                        onChange={(e) => changeWarehouse(e.target.value)}
                        disabled={warehouses.length === 0}
                    >
                        {warehouses.map((w) => (
                            <MenuItem key={w.id} value={w.id}>
                                {w.name} ({w.code})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {!selectedWarehouseId && (
                    <Typography variant="body2" color="text.secondary">
                        No warehouses available for your account.
                    </Typography>
                )}

                {selectedWarehouseId && (
                    <>
                        {isCompactList ? (
                            <Stack spacing={1.25}>
                                {stocks.map((row) => (
                                    <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.product?.name}>
                                            {row.product?.name || '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.8125rem' }}>
                                            {[row.product?.sku ? `SKU ${row.product.sku}` : null, row.product?.unit].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                                            <Chip size="small" label={`On hand ${row.qty_on_hand}`} variant="outlined" />
                                            <Chip size="small" label={`Reserved ${row.qty_reserved}`} variant="outlined" />
                                            <Chip size="small" label={`Avail. ${row.qty_available}`} color="primary" variant="outlined" />
                                        </Stack>
                                    </Paper>
                                ))}
                                {stocks.length === 0 && (
                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No stock rows yet. Add an adjustment to create balances for products.
                                        </Typography>
                                    </Paper>
                                )}
                            </Stack>
                        ) : (
                            <Paper sx={{ overflowX: 'auto' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Product</TableCell>
                                            <TableCell>SKU</TableCell>
                                            <TableCell>Unit</TableCell>
                                            <TableCell align="right">On hand</TableCell>
                                            <TableCell align="right">Reserved</TableCell>
                                            <TableCell align="right">Available</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {stocks.map((row) => (
                                            <TableRow key={row.id} hover>
                                                <TableCell>{row.product?.name || '—'}</TableCell>
                                                <TableCell>{row.product?.sku || '—'}</TableCell>
                                                <TableCell>{row.product?.unit || '—'}</TableCell>
                                                <TableCell align="right">{row.qty_on_hand}</TableCell>
                                                <TableCell align="right">{row.qty_reserved}</TableCell>
                                                <TableCell align="right">{row.qty_available}</TableCell>
                                            </TableRow>
                                        ))}
                                        {stocks.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        No stock rows yet. Add an adjustment to create balances for products.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Paper>
                        )}
                    </>
                )}
            </Stack>

            <Dialog open={adjustOpen} onClose={closeAdjust} fullWidth maxWidth="sm">
                <DialogTitle>Stock adjustment</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <Typography variant="caption" color="text.secondary">
                            Positive qty increases on-hand; negative decreases. Cannot go below zero.
                        </Typography>
                        <FormControl fullWidth>
                            <InputLabel>Product</InputLabel>
                            <Select
                                label="Product"
                                value={adjustForm.product_id}
                                onChange={(e) => setAdjustForm((p) => ({ ...p, product_id: e.target.value }))}
                            >
                                {products.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.name}
                                        {p.sku ? ` (${p.sku})` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Quantity change"
                            type="number"
                            value={adjustForm.qty}
                            onChange={(e) => setAdjustForm((p) => ({ ...p, qty: e.target.value }))}
                            inputProps={{ step: 'any' }}
                            helperText="e.g. 10 or -2"
                        />
                        <TextField
                            label="Note (optional)"
                            value={adjustForm.note}
                            onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))}
                            multiline
                            minRows={2}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAdjust} disabled={processing}>
                        Cancel
                    </Button>
                    <Button onClick={submitAdjust} variant="contained" disabled={processing || !canAdjust}>
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
