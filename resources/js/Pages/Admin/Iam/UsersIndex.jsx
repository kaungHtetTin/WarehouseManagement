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
    Divider,
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
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

const initialForm = {
    id: null,
    name: '',
    email: '',
    status: 'ACTIVE',
    role_ids: [],
    password: '',
    warehouse_ids: [],
    warehouse_access_level: 'VIEW',
};

export default function UsersIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const { users = [], roles = [], warehouses = [], admin_app_url: adminAppUrl, flash = {} } = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);

    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, user) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedUser(user);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedUser(null);
    };

    const roleLookup = useMemo(
        () =>
            roles.reduce((acc, role) => {
                acc[role.id] = role.name;
                return acc;
            }, {}),
        [roles]
    );

    const openCreate = () => {
        setForm(initialForm);
        setError('');
        setOpen(true);
    };

    const openEdit = (user) => {
        const assigned = user.warehouses || [];
        setForm({
            id: user.id,
            name: user.name ?? '',
            email: user.email ?? '',
            status: user.status ?? 'ACTIVE',
            role_ids: (user.roles || []).map((role) => role.id),
            password: '',
            warehouse_ids: assigned.map((w) => w.id),
            warehouse_access_level: assigned[0]?.pivot?.access_level ?? 'VIEW',
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
            email: form.email,
            status: form.status,
            role_ids: form.role_ids,
            warehouse_ids: form.warehouse_ids,
            warehouse_access_level: form.warehouse_access_level,
        };

        if (!form.id && form.password) {
            payload.password = form.password;
        }

        const options = {
            preserveScroll: true,
            onError: () => setError('Unable to save user. Please check fields and try again.'),
            onFinish: () => setProcessing(false),
            onSuccess: closeDialog,
        };

        if (form.id) {
            router.patch(`${adminAppUrl}/iam/users/${form.id}`, payload, options);
        } else {
            router.post(`${adminAppUrl}/iam/users`, payload, options);
        }
    };

    const removeUser = (user) => {
        handleTableActionClose();
        if (!window.confirm(`Delete user "${user.name}"?`)) return;

        router.delete(`${adminAppUrl}/iam/users/${user.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title="User Management">
            <Head title="User Management" />
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
                            Users
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage organization users and role assignments.
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
                        <Tooltip title="New user" placement="bottom">
                            <Fab
                                color="primary"
                                size="small"
                                onClick={openCreate}
                                aria-label="Create new user"
                                sx={{ boxShadow: 2 }}
                            >
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Tooltip>
                    </Stack>
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {users.map((user) => (
                            <Paper key={user.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={user.name}>
                                            {user.name}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25, wordBreak: 'break-word', fontSize: '0.8125rem' }}
                                        >
                                            {user.email}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                                            <Chip
                                                size="small"
                                                label={user.status}
                                                color={user.status === 'ACTIVE' ? 'success' : 'default'}
                                                variant={user.status === 'ACTIVE' ? 'filled' : 'outlined'}
                                            />
                                            {(user.roles || []).map((role) => (
                                                <Chip key={role.id} label={role.name} size="small" variant="outlined" />
                                            ))}
                                        </Stack>
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={(event) => handleTableActionOpen(event, user)}
                                        aria-label="User actions"
                                        sx={{ flexShrink: 0, mt: -0.25 }}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Paper>
                        ))}
                        {users.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No users found.
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Roles</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id} hover>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={user.status}
                                                color={user.status === 'ACTIVE' ? 'success' : 'default'}
                                                variant={user.status === 'ACTIVE' ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                                                {(user.roles || []).map((role) => (
                                                    <Chip key={role.id} label={role.name} size="small" variant="outlined" />
                                                ))}
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => handleTableActionOpen(event, user)}
                                                aria-label="User actions"
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                No users found.
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
                            if (selectedUser) openEdit(selectedUser);
                            handleTableActionClose();
                        }}
                    >
                        Edit
                    </MenuItem>
                    <Divider />
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (selectedUser) removeUser(selectedUser);
                        }}
                    >
                        Delete
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? 'Edit User' : 'Create User'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField label="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <TextField
                            label="Email"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                        {!form.id && (
                            <TextField
                                label="Password (optional)"
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                            />
                        )}
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={form.status}
                                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                            >
                                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Roles</InputLabel>
                            <Select
                                label="Roles"
                                multiple
                                value={form.role_ids}
                                onChange={(e) => setForm((prev) => ({ ...prev, role_ids: e.target.value }))}
                                renderValue={(selected) => selected.map((id) => roleLookup[id] || id).join(', ')}
                            >
                                {roles.map((role) => (
                                    <MenuItem key={role.id} value={role.id}>
                                        {role.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Warehouse access</InputLabel>
                            <Select
                                label="Warehouse access"
                                multiple
                                value={form.warehouse_ids}
                                onChange={(e) => setForm((prev) => ({ ...prev, warehouse_ids: e.target.value }))}
                                renderValue={(selected) =>
                                    selected
                                        .map((id) => warehouses.find((w) => w.id === id)?.display_name || id)
                                        .join(', ')
                                }
                                disabled={warehouses.length === 0}
                            >
                                {warehouses.map((warehouse) => (
                                    <MenuItem key={warehouse.id} value={warehouse.id}>
                                        {warehouse.display_name || warehouse.city}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Warehouse access level</InputLabel>
                            <Select
                                label="Warehouse access level"
                                value={form.warehouse_access_level}
                                onChange={(e) => setForm((prev) => ({ ...prev, warehouse_access_level: e.target.value }))}
                                disabled={form.warehouse_ids.length === 0}
                            >
                                <MenuItem value="VIEW">VIEW</MenuItem>
                                <MenuItem value="OPERATE">OPERATE</MenuItem>
                                <MenuItem value="MANAGE">MANAGE</MenuItem>
                            </Select>
                        </FormControl>
                        <Typography variant="caption" color="text.secondary">
                            Users with the &quot;manage warehouses&quot; permission can access all warehouses. Scoped access applies to other roles and is enforced once inventory features are wired.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} disabled={processing}>
                        Cancel
                    </Button>
                    <Button onClick={submit} variant="contained" disabled={processing}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
