import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, usePage } from '@inertiajs/react';
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
            onError: () => setError('Unable to save category. Please check fields and try again.'),
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
        if (!window.confirm(`Delete category "${category.name}"?`)) return;
        router.delete(`${adminAppUrl}/master/categories/${category.id}`, { preserveScroll: true });
    };

    return (
        <AdminLayout title="Categories">
            <Head title="Categories" />
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
                            Categories
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Product grouping for inventory management.
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
                            <Fab size="small" color="primary" onClick={openCreate} aria-label="Create category" sx={{ boxShadow: 2 }}>
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
                                            {category.code ? `Code: ${category.code}` : 'No code'}
                                            {category.parent?.name ? ` · Parent: ${category.parent.name}` : ''}
                                        </Typography>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(event) => handleTableActionOpen(event, category)}
                                            aria-label="Category actions"
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
                                    No categories yet.
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
                                    <TableCell>Code</TableCell>
                                    <TableCell>Parent</TableCell>
                                    <TableCell align="right">Actions</TableCell>
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
                                                    aria-label="Category actions"
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
                                                No categories yet.
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
                        Edit
                    </MenuItem>
                    <MenuItem
                        dense
                        sx={{ color: 'error.main' }}
                        onClick={() => {
                            if (selectedCategory) removeCategory(selectedCategory);
                        }}
                    >
                        Delete
                    </MenuItem>
                </Menu>
            </Stack>

            <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{form.id ? 'Edit Category' : 'Create Category'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                        <TextField label="Code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
                        <FormControl fullWidth>
                            <InputLabel>Parent Category</InputLabel>
                            <Select
                                label="Parent Category"
                                value={form.parent_id}
                                onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
                            >
                                <MenuItem value="">None</MenuItem>
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
                        Cancel
                    </Button>
                    <Button onClick={submit} variant="contained" disabled={processing || !canManage}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
