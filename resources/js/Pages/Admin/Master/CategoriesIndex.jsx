import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Box,
    Button,
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
    name: '',
    code: '',
    parent_id: '',
};

export default function CategoriesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const { categories = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const canManage = (auth?.permission_codes ?? []).includes('inventory.manage');
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, category) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedCategory(category);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedCategory(null);
    };

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (category) => {
        setForm({
            id: category.id,
            name: category.name ?? '',
            code: category.code ?? '',
            parent_id: category.parent_id ?? '',
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
            name: form.name,
            code: form.code || null,
            parent_id: form.parent_id || null,
        };

        const options = {
            preserveScroll: true,
            onError: () => setError(t('master.categories.errors.save_failed')),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };

        if (form.id) {
            router.patch(`${adminAppUrl}/master/categories/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/master/categories`, payload, options);
        }
    };

    const removeCategory = (category) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(t('master.categories.confirm.delete', { name: category.name }))) return;
        router.delete(`${adminAppUrl}/master/categories/${category.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('nav.categories')}>
            <Head title={t('nav.categories')} />
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
                            {t('nav.categories')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('master.categories.subtitle')}
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
                            <Fab size="small" color="primary" onClick={openCreate} aria-label={t('master.categories.actions.create')} sx={{ boxShadow: 2 }}>
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Stack>
                    )}
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {categories.map((category) => (
                            <Paper key={category.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={category.name}>
                                            {category.name}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                        >
                                            {category.code ? t('master.categories.code_value', { code: category.code }) : t('master.categories.no_code')}
                                            {category.parent?.name ? ` · ${t('master.categories.parent_value', { parent: category.parent.name })}` : ''}
                                        </Typography>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(event) => handleTableActionOpen(event, category)}
                                            aria-label={t('master.categories.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {categories.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('master.categories.empty')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('master.categories.table.name')}</TableCell>
                                    <TableCell>{t('master.categories.table.code')}</TableCell>
                                    <TableCell>{t('master.categories.table.parent')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id} hover>
                                        <TableCell>{category.name}</TableCell>
                                        <TableCell>{category.code || '-'}</TableCell>
                                        <TableCell>{category.parent?.name || '-'}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => handleTableActionOpen(event, category)}
                                                aria-label={t('master.categories.actions.row_actions')}
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {categories.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('master.categories.empty')}
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
                            if (selectedCategory) openEdit(selectedCategory);
                            handleTableActionClose();
                        }}
                    >
                        {t('ui.edit')}
                    </MenuItem>
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (selectedCategory) removeCategory(selectedCategory);
                        }}
                    >
                        {t('ui.delete')}
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? t('master.categories.dialog.edit_title') : t('master.categories.dialog.create_title')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('master.categories.fields.name')}
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        />
                        <TextField
                            label={t('master.categories.fields.code')}
                            value={form.code}
                            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('master.categories.fields.parent_category')}</InputLabel>
                            <Select
                                label={t('master.categories.fields.parent_category')}
                                value={form.parent_id}
                                onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
                            >
                                <MenuItem value="">{t('ui.none')}</MenuItem>
                                {categories
                                    .filter((c) => c.id !== form.id)
                                    .map((category) => (
                                        <MenuItem key={category.id} value={category.id}>
                                            {category.name}
                                        </MenuItem>
                                    ))}
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
