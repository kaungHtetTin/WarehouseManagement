import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
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
    category_id: '',
    sku: '',
    name: '',
    unit: '',
    default_weight: '',
    status: 'ACTIVE',
};

export default function ProductsIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const { products = [], categories = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const canManage = (auth?.permission_codes ?? []).includes('inventory.manage');
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, product) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedProduct(product);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedProduct(null);
    };

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (product) => {
        setForm({
            id: product.id,
            category_id: product.category_id ?? '',
            sku: product.sku ?? '',
            name: product.name ?? '',
            unit: product.unit ?? '',
            default_weight: product.default_weight ?? '',
            status: product.status ?? 'ACTIVE',
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
            category_id: form.category_id || null,
            sku: form.sku || null,
            name: form.name,
            unit: form.unit,
            default_weight: form.default_weight || null,
            status: form.status,
        };

        const options = {
            preserveScroll: true,
            onError: () => setError(t('master.products.errors.save_failed')),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };

        if (form.id) {
            router.patch(`${adminAppUrl}/master/products/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/master/products`, payload, options);
        }
    };

    const removeProduct = (product) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(t('master.products.confirm.delete', { name: product.name }))) return;
        router.delete(`${adminAppUrl}/master/products/${product.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('nav.products')}>
            <Head title={t('nav.products')} />
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
                            {t('nav.products')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('master.products.subtitle')}
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
                            <Fab size="small" color="primary" onClick={openCreate} aria-label={t('master.products.actions.create')} sx={{ boxShadow: 2 }}>
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Stack>
                    )}
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {products.map((product) => (
                            <Paper key={product.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={product.name}>
                                            {product.name}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                        >
                                            {[
                                                product.sku ? t('master.products.fields.sku_value', { sku: product.sku }) : null,
                                                product.category?.name,
                                                product.unit,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                                            <Chip
                                                size="small"
                                                label={product.status}
                                                color={product.status === 'ACTIVE' ? 'success' : 'default'}
                                                variant={product.status === 'ACTIVE' ? 'filled' : 'outlined'}
                                            />
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(event) => handleTableActionOpen(event, product)}
                                            aria-label={t('master.products.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {products.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('master.products.empty')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('master.products.table.sku')}</TableCell>
                                    <TableCell>{t('master.products.table.name')}</TableCell>
                                    <TableCell>{t('master.products.table.category')}</TableCell>
                                    <TableCell>{t('master.products.table.unit')}</TableCell>
                                    <TableCell>{t('master.products.table.status')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {products.map((product) => (
                                    <TableRow key={product.id} hover>
                                        <TableCell>{product.sku || '-'}</TableCell>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.category?.name || '-'}</TableCell>
                                        <TableCell>{product.unit}</TableCell>
                                        <TableCell>{product.status}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => handleTableActionOpen(event, product)}
                                                    aria-label={t('master.products.actions.row_actions')}
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('master.products.empty')}
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
                            if (selectedProduct) openEdit(selectedProduct);
                            handleTableActionClose();
                        }}
                    >
                        {t('ui.edit')}
                    </MenuItem>
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (selectedProduct) removeProduct(selectedProduct);
                        }}
                    >
                        {t('ui.delete')}
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? t('master.products.dialog.edit_title') : t('master.products.dialog.create_title')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('master.products.fields.sku_optional')}
                            value={form.sku}
                            onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                            helperText={t('master.products.fields.sku_hint')}
                        />
                        <TextField
                            label={t('master.products.fields.name')}
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('master.products.fields.category')}</InputLabel>
                            <Select
                                label={t('master.products.fields.category')}
                                value={form.category_id}
                                onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                            >
                                <MenuItem value="">{t('ui.none')}</MenuItem>
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label={t('master.products.fields.unit')}
                            value={form.unit}
                            onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                        />
                        <TextField
                            label={t('master.products.fields.default_weight_optional')}
                            type="number"
                            value={form.default_weight}
                            onChange={(e) => setForm((p) => ({ ...p, default_weight: e.target.value }))}
                            inputProps={{ min: 0, step: 'any' }}
                            helperText={t('master.products.fields.default_weight_hint')}
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('master.products.fields.status')}</InputLabel>
                            <Select
                                label={t('master.products.fields.status')}
                                value={form.status}
                                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                            >
                                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} disabled={processing}>
                        {t('ui.cancel')}
                    </Button>
                    <Button onClick={submit} variant="contained" disabled={processing || !canManage}>
                        {t('ui.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
