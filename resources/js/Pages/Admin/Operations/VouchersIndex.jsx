import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Chip,
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
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon, NotificationsActiveOutlined as NotificationsIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

export default function VouchersIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const {
        vouchers = [],
        warehouses = [],
        voucher_warehouse_filter: voucherWarehouseFilter = 'all',
        voucher_payment_filter: voucherPaymentFilter = 'all',
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
    } = usePage().props;
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
        if (row.status !== 'DRAFT' && row.status !== 'CONFIRMED') return;
        const label = row.status === 'DRAFT' ? 'Delete draft voucher' : 'Safe delete confirmed voucher';
        if (!window.confirm(`${label} "${row.voucher_no}"?`)) return;
        router.delete(`${adminAppUrl}/operations/vouchers/${row.id}`, { preserveScroll: true });
    };

    const statusColor = (status) => {
        if (status === 'DRAFT') return 'default';
        if (status === 'CONFIRMED') return 'success';
        if (status === 'CANCELLED') return 'error';
        if (status === 'DELIVERED' || status === 'CLOSED') return 'success';
        return 'primary';
    };

    const voucherHref = (row) => {
        if (!row?.id) return null;
        if (row.status === 'DRAFT') {
            return canWizard ? `${adminAppUrl}/operations/vouchers/${row.id}/edit` : null;
        }
        return `${adminAppUrl}/operations/vouchers/${row.id}`;
    };

    const needsAction = (row) => row?.status !== 'DRAFT' && (row?.payment_status === 'UNPAID' || row?.payment_status === 'PARTIAL');

    const actionNeededCount = useMemo(() => vouchers.filter((r) => needsAction(r)).length, [vouchers]);

    return (
        <AdminLayout title="Vouchers">
            <Head title="Vouchers" />
            <Stack spacing={2}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}
                {actionNeededCount > 0 ? (
                    <Alert severity="warning">
                        {actionNeededCount} voucher{actionNeededCount === 1 ? '' : 's'} need action (payment is UNPAID / PARTIAL).
                    </Alert>
                ) : null}

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
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25 }}>
                            <FormControl size="small" sx={{ width: { xs: '100%', sm: 260 } }}>
                                <InputLabel id="voucher-wh-filter">Warehouse</InputLabel>
                                <Select
                                    labelId="voucher-wh-filter"
                                    label="Warehouse"
                                    value={voucherWarehouseFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        router.get(
                                            `${adminAppUrl}/operations/vouchers`,
                                            { warehouse_id: v, payment_status: voucherPaymentFilter },
                                            { preserveScroll: true },
                                        );
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.display_name || w.city}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
                                <InputLabel id="voucher-pay-filter">Payment</InputLabel>
                                <Select
                                    labelId="voucher-pay-filter"
                                    label="Payment"
                                    value={voucherPaymentFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        router.get(
                                            `${adminAppUrl}/operations/vouchers`,
                                            { warehouse_id: voucherWarehouseFilter, payment_status: v },
                                            { preserveScroll: true },
                                        );
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="UNPAID">Unpaid</MenuItem>
                                    <MenuItem value="PARTIAL">Partial</MenuItem>
                                    <MenuItem value="PAID">Paid</MenuItem>
                                    <MenuItem value="WAIVED">Waived</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
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
                                        {voucherHref(row) ? (
                                            <Typography
                                                variant="subtitle2"
                                                component={Link}
                                                href={voucherHref(row)}
                                                sx={{ fontWeight: 700, lineHeight: 1.3 }}
                                                noWrap
                                                title={row.voucher_no}
                                            >
                                                {row.voucher_no}
                                            </Typography>
                                        ) : (
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap title={row.voucher_no}>
                                                {row.voucher_no}
                                            </Typography>
                                        )}
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.8125rem' }}>
                                            {[row.merchant?.name, row.source_warehouse?.display_name].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                            <Chip size="small" label={row.status} color={statusColor(row.status)} variant="outlined" />
                                            {needsAction(row) ? (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    variant="outlined"
                                                    icon={<NotificationsIcon fontSize="small" />}
                                                    label={`Payment ${row.payment_status}`}
                                                />
                                            ) : null}
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
                                        <TableCell sx={{ fontWeight: 600 }}>
                                            {voucherHref(row) ? <Link href={voucherHref(row)}>{row.voucher_no}</Link> : row.voucher_no}
                                        </TableCell>
                                        <TableCell>{typeof row.voucher_date === 'string' ? row.voucher_date.slice(0, 10) : row.voucher_date}</TableCell>
                                        <TableCell>{row.merchant?.name ?? '—'}</TableCell>
                                        <TableCell>{row.source_warehouse?.display_name ?? '—'}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.75} alignItems="center">
                                                <Chip size="small" label={row.status} color={statusColor(row.status)} variant="outlined" />
                                                {needsAction(row) ? (
                                                    <Chip
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                        icon={<NotificationsIcon fontSize="small" />}
                                                        label={`Payment ${row.payment_status}`}
                                                    />
                                                ) : null}
                                            </Stack>
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
                    {(selectedRow?.status === 'DRAFT' || selectedRow?.status === 'CONFIRMED') && (
                        <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)}>
                            {selectedRow?.status === 'DRAFT' ? 'Delete' : 'Safe delete'}
                        </MenuItem>
                    )}
                </Menu>
            </Stack>
        </AdminLayout>
    );
}
