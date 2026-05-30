import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
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
    IconButton,
    Menu,
    MenuItem,
    Paper,
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
    phone: '',
    nrc_or_id: '',
    address: '',
};

export default function MerchantsIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const { merchants = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const canManage = (auth?.permission_codes ?? []).includes('inventory.manage');
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRow(null);
    };

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (row) => {
        setForm({
            id: row.id,
            name: row.name ?? '',
            phone: row.phone ?? '',
            nrc_or_id: row.nrc_or_id ?? '',
            address: row.address ?? '',
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
            phone: form.phone || null,
            nrc_or_id: form.nrc_or_id || null,
            address: form.address || null,
        };
        const options = {
            preserveScroll: true,
            onError: () => setError(t('master.merchants.errors.save_failed')),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };
        if (form.id) {
            router.patch(`${adminAppUrl}/master/merchants/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/master/merchants`, payload, options);
        }
    };

    const removeRow = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (!window.confirm(t('master.merchants.confirm.delete', { name: row.name }))) return;
        router.delete(`${adminAppUrl}/master/merchants/${row.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('nav.merchants')}>
            <Head title={t('nav.merchants')} />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    title={t('nav.merchants')}
                    subtitle={t('master.merchants.subtitle')}
                    actions={
                        canManage ? (
                            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
                                <Fab size="small" color="primary" onClick={openCreate} aria-label={t('master.merchants.actions.create')} sx={{ boxShadow: 2 }}>
                                    <AddIcon fontSize="small" />
                                </Fab>
                            </Stack>
                        ) : null
                    }
                />

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {merchants.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.name}>
                                            {row.name}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                        >
                                            {[row.phone, row.nrc_or_id].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        {row.address && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                {row.address}
                                            </Typography>
                                        )}
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label={t('master.merchants.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {merchants.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('master.merchants.empty')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('master.merchants.table.name')}</TableCell>
                                    <TableCell>{t('master.merchants.table.phone')}</TableCell>
                                    <TableCell>{t('master.merchants.table.nrc_or_id')}</TableCell>
                                    <TableCell>{t('master.merchants.table.address')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {merchants.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell>{row.phone || '—'}</TableCell>
                                        <TableCell>{row.nrc_or_id || '—'}</TableCell>
                                        <TableCell sx={{ maxWidth: 220 }}>{row.address || '—'}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label={t('master.merchants.actions.row_actions')}>
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {merchants.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('master.merchants.empty')}
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
                            if (selectedRow) openEdit(selectedRow);
                            handleTableActionClose();
                        }}
                    >
                        {t('ui.edit')}
                    </MenuItem>
                    <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)}>
                        {t('ui.delete')}
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? t('master.merchants.dialog.edit_title') : t('master.merchants.dialog.create_title')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('master.merchants.fields.name')}
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        />
                        <TextField
                            label={t('master.merchants.fields.phone')}
                            value={form.phone}
                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        />
                        <TextField
                            label={t('master.merchants.fields.nrc_or_id')}
                            value={form.nrc_or_id}
                            onChange={(e) => setForm((p) => ({ ...p, nrc_or_id: e.target.value }))}
                        />
                        <TextField
                            label={t('master.merchants.fields.address')}
                            multiline
                            minRows={2}
                            value={form.address}
                            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                        />
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
