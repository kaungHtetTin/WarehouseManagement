import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Fab,
    FormControlLabel,
    FormGroup,
    IconButton,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Table,
    Tooltip,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon, ExpandMore as ExpandMoreIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

const initialForm = {
    id: null,
    name: '',
    code: '',
    permission_ids: [],
};

export default function RolesIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const { roles = [], permissions = [], admin_app_url: adminAppUrl, flash = {} } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    /** Compact view: per-role permission list collapse (default collapsed). */
    const [permissionsExpandedByRole, setPermissionsExpandedByRole] = useState({});

    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, role) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRole(role);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRole(null);
    };

    const groupedPermissions = useMemo(() => {
        return permissions.reduce((acc, permission) => {
            const key = permission.module || 'general';
            if (!acc[key]) acc[key] = [];
            acc[key].push(permission);
            return acc;
        }, {});
    }, [permissions]);

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (role) => {
        setForm({
            id: role.id,
            name: role.name ?? '',
            code: role.code ?? '',
            permission_ids: (role.permissions || []).map((permission) => permission.id),
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

    const togglePermission = (permissionId) => {
        setForm((prev) => {
            const exists = prev.permission_ids.includes(permissionId);
            return {
                ...prev,
                permission_ids: exists
                    ? prev.permission_ids.filter((id) => id !== permissionId)
                    : [...prev.permission_ids, permissionId],
            };
        });
    };

    const submit = () => {
        setProcessing(true);
        setError('');

        const payload = {
            name: form.name,
            code: form.code || null,
            permission_ids: form.permission_ids,
        };

        const options = {
            preserveScroll: true,
            onError: () => setError(t('iam.roles.errors.save_failed')),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };

        if (form.id) {
            router.patch(`${adminAppUrl}/iam/roles/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/iam/roles`, payload, options);
        }
    };

    const togglePermissionsExpanded = (roleId) => {
        setPermissionsExpandedByRole((prev) => ({
            ...prev,
            [roleId]: !prev[roleId],
        }));
    };

    const removeRole = (role) => {
        handleTableActionClose();
        if (!window.confirm(t('iam.roles.confirm.delete', { name: role.name }))) return;
        router.delete(`${adminAppUrl}/iam/roles/${role.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title={t('iam.roles.title')}>
            <Head title={t('iam.roles.title')} />
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
                            {t('iam.roles.heading')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('iam.roles.subtitle')}
                        </Typography>
                    </Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                            flexShrink: 0,
                            alignItems: 'center',
                            alignSelf: { xs: 'flex-end', md: 'auto' },
                        }}
                    >
                        <Tooltip title={t('iam.roles.actions.new_role')} placement="bottom">
                            <Fab
                                color="primary"
                                size="small"
                                onClick={openCreate}
                                aria-label={t('iam.roles.actions.create')}
                                sx={{ boxShadow: 2 }}
                            >
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Tooltip>
                    </Stack>
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {roles.map((role) => {
                            const perms = role.permissions || [];
                            const permCount = perms.length;
                            const expanded = !!permissionsExpandedByRole[role.id];

                            return (
                                <Paper key={role.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={role.name}>
                                                {role.name}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                            >
                                                {role.code}
                                            </Typography>
                                            <Box sx={{ mt: 1 }}>
                                                <Chip
                                                    size="small"
                                                    label={role.is_system_role ? t('iam.roles.type.system') : t('iam.roles.type.custom')}
                                                    color={role.is_system_role ? 'info' : 'default'}
                                                    variant={role.is_system_role ? 'filled' : 'outlined'}
                                                />
                                            </Box>

                                            {permCount === 0 ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                                    {t('iam.roles.no_permissions')}
                                                </Typography>
                                            ) : (
                                                <>
                                                    <Box
                                                        component="button"
                                                        type="button"
                                                        onClick={() => togglePermissionsExpanded(role.id)}
                                                        aria-expanded={expanded}
                                                        sx={{
                                                            width: '100%',
                                                            mt: 1,
                                                            py: 0.75,
                                                            px: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: 1,
                                                            border: 1,
                                                            borderColor: 'divider',
                                                            borderRadius: 1,
                                                            bgcolor: 'action.hover',
                                                            cursor: 'pointer',
                                                            font: 'inherit',
                                                            color: 'text.primary',
                                                            textAlign: 'left',
                                                        }}
                                                    >
                                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                            {t('iam.roles.permissions_count', { count: permCount })}
                                                        </Typography>
                                                        <ExpandMoreIcon
                                                            sx={{
                                                                fontSize: 20,
                                                                transition: theme.transitions.create('transform', {
                                                                    duration: theme.transitions.duration.shortest,
                                                                }),
                                                                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            }}
                                                        />
                                                    </Box>
                                                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                        <Stack
                                                            component="ul"
                                                            spacing={0.5}
                                                            sx={{
                                                                m: 0,
                                                                mt: 1,
                                                                pl: 2,
                                                                pr: 0,
                                                                py: 0,
                                                                listStyle: 'disc',
                                                                color: 'text.secondary',
                                                            }}
                                                        >
                                                            {perms.map((permission) => (
                                                                <Typography key={permission.id} component="li" variant="caption" sx={{ display: 'list-item' }}>
                                                                    <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
                                                                        {permission.code}
                                                                    </Box>
                                                                </Typography>
                                                            ))}
                                                        </Stack>
                                                    </Collapse>
                                                </>
                                            )}
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={(event) => handleTableActionOpen(event, role)}
                                            aria-label={t('iam.roles.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                </Paper>
                            );
                        })}
                        {roles.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('iam.roles.empty')}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('iam.roles.table.role')}</TableCell>
                                    <TableCell>{t('iam.roles.table.code')}</TableCell>
                                    <TableCell>{t('iam.roles.table.type')}</TableCell>
                                    <TableCell>{t('iam.roles.table.permissions')}</TableCell>
                                    <TableCell align="right">{t('ui.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow key={role.id} hover>
                                        <TableCell>{role.name}</TableCell>
                                        <TableCell>{role.code}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={role.is_system_role ? t('iam.roles.type.system') : t('iam.roles.type.custom')}
                                                color={role.is_system_role ? 'info' : 'default'}
                                                variant={role.is_system_role ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                                                {(role.permissions || []).map((permission) => (
                                                    <Chip key={permission.id} size="small" variant="outlined" label={permission.code} />
                                                ))}
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => handleTableActionOpen(event, role)}
                                                aria-label={t('iam.roles.actions.row_actions')}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {roles.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('iam.roles.empty')}
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
                    {selectedRole?.is_system_role ? (
                        <MenuItem dense disabled>
                            {t('iam.roles.protected_system_role')}
                        </MenuItem>
                    ) : (
                        <>
                            <MenuItem
                                dense
                                onClick={() => {
                                    if (selectedRole) openEdit(selectedRole);
                                    handleTableActionClose();
                                }}
                            >
                                {t('ui.edit')}
                            </MenuItem>
                            <Divider />
                            <MenuItem
                                dense
                                sx={{ color: 'error.main' }}
                                onClick={() => {
                                    if (selectedRole) removeRole(selectedRole);
                                }}
                            >
                                {t('ui.delete')}
                            </MenuItem>
                        </>
                    )}
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
                <DialogTitle>{form.id ? t('iam.roles.dialog.edit_title') : t('iam.roles.dialog.create_title')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label={t('iam.roles.fields.role_name')}
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <TextField
                            label={t('iam.roles.fields.role_code')}
                            helperText={t('iam.roles.fields.role_code_hint')}
                            value={form.code}
                            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                        />
                        {Object.keys(groupedPermissions).map((module) => (
                            <Paper key={module} sx={{ p: 1.5 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'capitalize', fontWeight: 700 }}>
                                    {module}
                                </Typography>
                                <FormGroup>
                                    {groupedPermissions[module].map((permission) => (
                                        <FormControlLabel
                                            key={permission.id}
                                            control={
                                                <Checkbox
                                                    checked={form.permission_ids.includes(permission.id)}
                                                    onChange={() => togglePermission(permission.id)}
                                                />
                                            }
                                            label={`${permission.name} (${permission.code})`}
                                        />
                                    ))}
                                </FormGroup>
                            </Paper>
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} disabled={processing}>
                        {t('ui.cancel')}
                    </Button>
                    <Button onClick={submit} variant="contained" disabled={processing}>
                        {t('ui.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
