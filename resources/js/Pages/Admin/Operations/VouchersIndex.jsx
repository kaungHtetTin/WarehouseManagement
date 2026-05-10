import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Alert, Box, Chip, Fab, IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { useState } from 'react';

export default function VouchersIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const { vouchers = [], admin_app_url: adminAppUrl, flash = {}, auth } = usePage().props;
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('vouchers.manage');
    const canWizard = canManage && permissionCodes.includes('inventory.manage');
    const canViewDetail = permissionCodes.includes('vouchers.view');
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedRow(null);
    };

    const goEditDraft = (row) => {
        handleTableActionClose();
        if (!canWizard || row?.status !== 'DRAFT') return;
        router.visit(`${adminAppUrl}/operations/vouchers/${row.id}/edit`);
    };

    const removeRow = (row) => {
        handleTableActionClose();
        if (!canManage) return;
        if (row.status !== 'DRAFT') return;
        if (!window.confirm(`Delete draft voucher "${row.voucher_no}"?`)) return;
        router.delete(`${adminAppUrl}/operations/vouchers/${row.id}`, { preserveScroll: true });
    };

    const statusColor = (status) => {
        if (status === 'DRAFT') return 'default';
        if (status === 'CONFIRMED') return 'success';
        if (status === 'CANCELLED') return 'error';
        if (status === 'DELIVERED' || status === 'CLOSED') return 'success';
        return 'primary';
    };

    return (
        <AdminLayout title="Vouchers">
            <Head title="Vouchers" />
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
                            Vouchers
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Shipment documents (drafts open in the wizard; confirmed vouchers are read-only here).
                            {canManage &&
                                !canWizard &&
                                ' Creating or editing drafts in the wizard requires inventory.manage in addition to vouchers.manage.'}
                        </Typography>
                    </Box>
                    {canWizard && (
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                                flexShrink: 0,
                                alignItems: 'center',
                                alignSelf: { xs: 'flex-end', md: 'auto' },
                            }}
                        >
                            <Fab
                                size="small"
                                color="primary"
                                onClick={() => router.visit(`${adminAppUrl}/operations/vouchers/create`)}
                                aria-label="Create voucher with wizard"
                                sx={{ boxShadow: 2 }}
                            >
                                <AddIcon fontSize="small" />
                            </Fab>
                        </Stack>
                    )}
                </Stack>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {vouchers.map((row) => (
                            <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.voucher_no}>
                                            {row.voucher_no}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.8125rem' }}>
                                            {[row.merchant?.name, row.source_warehouse?.name].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                            <Chip size="small" label={row.status} color={statusColor(row.status)} variant="outlined" />
                                            <Chip size="small" label={`${row.items?.length ?? 0} lines`} variant="outlined" />
                                        </Stack>
                                    </Box>
                                    {canManage && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label="Voucher actions"
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {vouchers.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No vouchers yet.
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Voucher</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Merchant</TableCell>
                                    <TableCell>Source warehouse</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Lines</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {vouchers.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>{row.voucher_no}</TableCell>
                                        <TableCell>{typeof row.voucher_date === 'string' ? row.voucher_date.slice(0, 10) : row.voucher_date}</TableCell>
                                        <TableCell>{row.merchant?.name ?? '—'}</TableCell>
                                        <TableCell>{row.source_warehouse?.name ?? '—'}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={row.status} color={statusColor(row.status)} variant="outlined" />
                                        </TableCell>
                                        <TableCell align="right">{row.items?.length ?? 0}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canManage && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label="Voucher actions">
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {vouchers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <Typography variant="body2" color="text.secondary">
                                                No vouchers yet.
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
                    {selectedRow && selectedRow.status !== 'DRAFT' && canViewDetail && (
                        <MenuItem dense component={Link} href={`${adminAppUrl}/operations/vouchers/${selectedRow.id}`} onClick={handleTableActionClose}>
                            View details
                        </MenuItem>
                    )}
                    {selectedRow?.status === 'DRAFT' && canWizard && (
                        <MenuItem dense onClick={() => selectedRow && goEditDraft(selectedRow)}>
                            Edit in wizard
                        </MenuItem>
                    )}
                    {selectedRow?.status === 'DRAFT' && canManage && !canWizard && (
                        <MenuItem dense disabled>
                            Edit requires inventory.manage (wizard)
                        </MenuItem>
                    )}
                    {selectedRow?.status === 'DRAFT' && (
                        <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)}>
                            Delete
                        </MenuItem>
                    )}
                </Menu>
            </Stack>
        </AdminLayout>
    );
}
