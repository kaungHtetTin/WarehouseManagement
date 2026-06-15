import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import PaginationBar from '@/Components/PaginationBar';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import { voucherPaymentChipLabel, voucherPaymentStatusLabel, voucherStatusLabel } from '@/utils/statusLabels';
import {
    Alert,
    Box,
    Button,
    Chip,
    Fab,
    FormControl,
    Grid,
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
import { Add as AddIcon, MoreVert as MoreVertIcon, NotificationsActiveOutlined as NotificationsIcon } from '@mui/icons-material';
import { useEffect, useState } from 'react';

export default function VouchersIndex() {
    const theme = useTheme();
    const isCompactList = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const {
        vouchers = { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 },
        warehouses = [],
        voucher_warehouse_filter: voucherWarehouseFilter = 'all',
        voucher_source_warehouse_filter: voucherSourceWarehouseFilter = 'all',
        voucher_payment_filter: voucherPaymentFilter = 'all',
        voucher_status_filter: voucherStatusFilter = 'all',
        voucher_search_filter: voucherSearchFilter = '',
        voucher_date_filter: voucherDateFilter = '',
        voucher_summary: voucherSummary = {},
        admin_app_url: adminAppUrl,
        flash = {},
        auth,
    } = usePage().props;
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [searchInput, setSearchInput] = useState(voucherSearchFilter);
    const permissionCodes = auth?.permission_codes ?? [];
    const canManage = permissionCodes.includes('vouchers.manage');
    const canWizard = canManage && permissionCodes.includes('inventory.manage');
    const canViewDetail = permissionCodes.includes('vouchers.view');
    const canRecordVoucherPayments = permissionCodes.includes('payments.manage');
    const openTableActionMenu = Boolean(tableActionAnchorEl);
    const todayDate = new Date().toISOString().slice(0, 10);
    const voucherRows = Array.isArray(vouchers.data) ? vouchers.data : [];

    useEffect(() => {
        setSearchInput(voucherSearchFilter);
    }, [voucherSearchFilter]);

    const applyFilters = (overrides = {}) => {
        router.get(
            `${adminAppUrl}/operations/vouchers`,
            {
                destination_warehouse_id: voucherWarehouseFilter,
                source_warehouse_id: voucherSourceWarehouseFilter,
                payment_status: voucherPaymentFilter,
                status: voucherStatusFilter,
                search: searchInput.trim(),
                voucher_date: voucherDateFilter,
                per_page: vouchers.per_page ?? 25,
                page: 1,
                ...overrides,
            },
            { preserveScroll: true },
        );
    };

    const resetFilters = () => {
        setSearchInput('');
        router.get(
            `${adminAppUrl}/operations/vouchers`,
            {
                destination_warehouse_id: 'all',
                source_warehouse_id: 'all',
                payment_status: 'all',
                status: 'all',
                search: '',
                voucher_date: '',
                per_page: vouchers.per_page ?? 25,
            },
            { preserveScroll: true },
        );
    };

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
        const label = row.status === 'DRAFT' ? t('vouchers.confirm.delete_draft_label') : t('vouchers.confirm.safe_delete_confirmed_label');
        if (!window.confirm(t('vouchers.confirm.delete_prompt', { label, voucher_no: row.voucher_no }))) return;
        router.delete(`${adminAppUrl}/operations/vouchers/${row.id}`, { preserveScroll: true });
    };

    const markAsPaid = (row) => {
        handleTableActionClose();
        if (!canRecordVoucherPayments) return;
        if (!row?.id || row?.status === 'DRAFT') return;
        if (row?.payment_status === 'PAID' || row?.payment_status === 'WAIVED') return;
        if (row?.total_amount == null) return;
        if (!window.confirm(t('vouchers.confirm.mark_paid', { voucher_no: row.voucher_no }))) return;
        router.post(`${adminAppUrl}/operations/vouchers/${row.id}/mark-paid`, {}, { preserveScroll: true });
    };

    const statusColor = (status) => {
        if (status === 'DRAFT') return 'default';
        if (status === 'CONFIRMED') return 'info';
        if (status === 'LOADING') return 'warning';
        if (status === 'IN_TRANSIT') return 'primary';
        if (status === 'PARTIALLY_DELIVERED') return 'warning';
        if (status === 'DELIVERED') return 'success';
        if (status === 'CLOSED') return 'default';
        if (status === 'CANCELLED') return 'error';
        return 'default';
    };

    const voucherHref = (row) => {
        if (!row?.id) return null;
        if (row.status === 'DRAFT') {
            return canWizard ? `${adminAppUrl}/operations/vouchers/${row.id}/edit` : null;
        }
        return `${adminAppUrl}/operations/vouchers/${row.id}`;
    };

    const needsAction = (row) => row?.status !== 'DRAFT' && (row?.payment_status === 'UNPAID' || row?.payment_status === 'PARTIAL');
    const canMarkAsPaid = (row) =>
        canRecordVoucherPayments &&
        row?.status !== 'DRAFT' &&
        row?.payment_status !== 'PAID' &&
        row?.payment_status !== 'WAIVED' &&
        row?.total_amount != null;
    const canUseRowActions = (row) => canManage || canMarkAsPaid(row);

    const actionNeededCount = Number(voucherSummary.action_needed ?? 0);
    const draftCount = Number(voucherSummary.drafts ?? 0);
    const deliveredCount = Number(voucherSummary.delivered ?? 0);
    const hasActiveFilters = Boolean(
        searchInput.trim() ||
            voucherWarehouseFilter !== 'all' ||
            voucherSourceWarehouseFilter !== 'all' ||
            voucherPaymentFilter !== 'all' ||
            voucherStatusFilter !== 'all' ||
            voucherDateFilter,
    );
    const recipientLabel = (row) => {
        const bits = [];
        if (row?.default_recipient_name) {
            bits.push(row.default_recipient_name);
        }
        if (row?.default_recipient_phone) {
            bits.push(row.default_recipient_phone);
        }
        return bits.length ? bits.join(' · ') : '—';
    };

    const warehouseLabel = (warehouse) => warehouse?.display_name ?? warehouse?.city ?? warehouse?.address ?? '—';

    const filterPresets = [
        {
            key: 'all',
            label: t('filters.all'),
            active: !hasActiveFilters,
            onClick: resetFilters,
        },
        {
            key: 'payments',
            label: t('vouchers.payment_status.unpaid'),
            active: voucherPaymentFilter === 'UNPAID' && voucherStatusFilter === 'all',
            onClick: () => applyFilters({ payment_status: 'UNPAID', status: 'all' }),
        },
        {
            key: 'confirmed',
            label: voucherStatusLabel('CONFIRMED', t),
            active: voucherStatusFilter === 'confirmed',
            onClick: () => applyFilters({ status: 'confirmed', payment_status: 'all' }),
        },
        {
            key: 'today',
            label: 'Today',
            active: voucherDateFilter === todayDate,
            onClick: () => applyFilters({ voucher_date: todayDate }),
        },
    ];

    const summaryCards = [
        { label: 'Results', value: vouchers.total ?? voucherRows.length, tone: 'primary.main' },
        { label: 'Need action', value: actionNeededCount, tone: actionNeededCount > 0 ? 'warning.main' : 'success.main' },
        { label: 'Drafts', value: draftCount, tone: 'text.primary' },
        { label: 'Delivered', value: deliveredCount, tone: 'success.main' },
    ];

    return (
        <AdminLayout title={t('nav.vouchers')}>
            <Head title={t('nav.vouchers')} />
            <Stack spacing={1.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}
                {actionNeededCount > 0 ? (
                    <Alert severity="warning">
                        {t('vouchers.alerts.needs_action', { count: actionNeededCount })}
                    </Alert>
                ) : null}

                <PageHeader
                    title={t('nav.vouchers')}
                    subtitle={`${t('vouchers.subtitle')}${canManage && !canWizard ? ` ${t('vouchers.subtitle_requires_inventory_manage')}` : ''}`}
                    actions={
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            {hasActiveFilters ? (
                                <Button size="small" variant="outlined" onClick={resetFilters}>
                                    Clear filters
                                </Button>
                            ) : null}
                            {canWizard ? (
                                <Fab
                                    size="small"
                                    color="primary"
                                    onClick={() => router.visit(`${adminAppUrl}/operations/vouchers/create`)}
                                    aria-label={t('vouchers.actions.create_with_wizard')}
                                    sx={{ boxShadow: 2 }}
                                >
                                    <AddIcon fontSize="small" />
                                </Fab>
                            ) : null}
                        </Stack>
                    }
                >
                    <Stack spacing={2}>
                        <Grid container spacing={1.5}>
                            {summaryCards.map((item) => (
                                <Grid key={item.label} item xs={6} md={3}>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 2,
                                            boxShadow: 'none',
                                            backgroundColor: 'background.paper',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary">
                                            {item.label}
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900, color: item.tone }}>
                                            {item.value}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                            {filterPresets.map((preset) => (
                                <Chip
                                    key={preset.key}
                                    label={preset.label}
                                    color={preset.active ? 'primary' : 'default'}
                                    variant={preset.active ? 'filled' : 'outlined'}
                                    onClick={preset.onClick}
                                />
                            ))}
                        </Stack>

                        <Grid container spacing={1.5}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                value={searchInput}
                                placeholder={t('vouchers.filters.search_placeholder')}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyFilters({ search: e.currentTarget.value.trim() });
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
                                <InputLabel id="voucher-source-wh-filter">{t('voucher_detail.fields.source_warehouse')}</InputLabel>
                                <Select
                                    labelId="voucher-source-wh-filter"
                                    label={t('voucher_detail.fields.source_warehouse')}
                                    value={voucherSourceWarehouseFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        applyFilters({ source_warehouse_id: v });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.display_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small" sx={{ minWidth:200 }}>
                                <InputLabel id="voucher-wh-filter">{t('trips.labels.destination_warehouse')}</InputLabel>
                                <Select
                                    labelId="voucher-wh-filter"
                                    label={t('trips.labels.destination_warehouse')}
                                    value={voucherWarehouseFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        applyFilters({ destination_warehouse_id: v });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.display_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small" sx={{ minWidth:100 }}>
                                <InputLabel id="voucher-pay-filter">{t('vouchers.filters.payment')}</InputLabel>
                                <Select
                                    labelId="voucher-pay-filter"
                                    label={t('vouchers.filters.payment')}
                                    value={voucherPaymentFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        applyFilters({ payment_status: v });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
                                    <MenuItem value="UNPAID">{t('vouchers.payment_status.unpaid')}</MenuItem>
                                    <MenuItem value="PARTIAL">{t('vouchers.payment_status.partial')}</MenuItem>
                                    <MenuItem value="PAID">{t('vouchers.payment_status.paid')}</MenuItem>
                                    <MenuItem value="WAIVED">{t('vouchers.payment_status.waived')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small" sx={{ minWidth: 80 }}>
                                <InputLabel id="voucher-status-filter">{t('vouchers.filters.status')}</InputLabel>
                                <Select
                                    labelId="voucher-status-filter"
                                    label={t('vouchers.filters.status')}
                                    value={voucherStatusFilter}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        applyFilters({ status: v });
                                    }}
                                >
                                    <MenuItem value="all">{t('filters.all')}</MenuItem>
                                    <MenuItem value="confirmed">{t('vouchers.status.confirmed')}</MenuItem>
                                    <MenuItem value="loading">{t('vouchers.status.loading')}</MenuItem>
                                    <MenuItem value="in_transit">{t('vouchers.status.in_transit')}</MenuItem>
                                    <MenuItem value="delivered">{t('vouchers.status.delivered')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={voucherDateFilter}
                                onChange={(e) => applyFilters({ voucher_date: e.target.value })}
                                inputProps={{ 'aria-label': t('vouchers.filters.created_date') }}
                                sx={{ minWidth: 150 }}
                            />
                        </Grid>
                        </Grid>

                        {hasActiveFilters ? (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {searchInput.trim() ? <Chip label={`Search: ${searchInput.trim()}`} onDelete={resetFilters} /> : null}
                                {voucherSourceWarehouseFilter !== 'all' ? (
                                    <Chip
                                        label={`Source: ${warehouseLabel(warehouses.find((w) => String(w.id) === String(voucherSourceWarehouseFilter)))}`}
                                        onDelete={() => applyFilters({ source_warehouse_id: 'all' })}
                                    />
                                ) : null}
                                {voucherWarehouseFilter !== 'all' ? (
                                    <Chip
                                        label={`Destination: ${warehouseLabel(warehouses.find((w) => String(w.id) === String(voucherWarehouseFilter)))}`}
                                        onDelete={() => applyFilters({ destination_warehouse_id: 'all' })}
                                    />
                                ) : null}
                                {voucherPaymentFilter !== 'all' ? (
                                    <Chip
                                        label={`${t('vouchers.filters.payment')}: ${voucherPaymentStatusLabel(voucherPaymentFilter, t)}`}
                                        onDelete={() => applyFilters({ payment_status: 'all' })}
                                    />
                                ) : null}
                                {voucherStatusFilter !== 'all' ? (
                                    <Chip
                                        label={`${t('vouchers.filters.status')}: ${voucherStatusLabel(voucherStatusFilter, t)}`}
                                        onDelete={() => applyFilters({ status: 'all' })}
                                    />
                                ) : null}
                                {voucherDateFilter ? (
                                    <Chip
                                        label={`Date: ${voucherDateFilter}`}
                                        onDelete={() => applyFilters({ voucher_date: '' })}
                                    />
                                ) : null}
                            </Stack>
                        ) : null}
                    </Stack>
                </PageHeader>

                {isCompactList ? (
                    <Stack spacing={1.25}>
                        {voucherRows.map((row) => (
                            <Paper
                                key={row.id}
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    boxShadow: 'none',
                                    borderColor: needsAction(row) ? 'warning.main' : 'divider',
                                    bgcolor: needsAction(row) ? 'warning.50' : 'background.paper',
                                }}
                            >
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
                                            {[recipientLabel(row), row.default_to_warehouse?.display_name].filter(Boolean).join(' · ') || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                            <Chip size="small" label={voucherStatusLabel(row.status, t)} color={statusColor(row.status)} variant="outlined" />
                                            {needsAction(row) ? (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    variant="outlined"
                                                    icon={<NotificationsIcon fontSize="small" />}
                                                    label={voucherPaymentChipLabel(row.payment_status, t)}
                                                />
                                            ) : null}
                                            <Chip size="small" label={t('vouchers.chip.lines', { count: row.items?.length ?? 0 })} variant="outlined" />
                                        </Stack>
                                    </Box>
                                    {canUseRowActions(row) && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleTableActionOpen(e, row)}
                                            aria-label={t('vouchers.actions.row_actions')}
                                            sx={{ flexShrink: 0, mt: -0.25 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                        {voucherRows.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.5, boxShadow: 'none', textAlign: 'center' }}>
                                <Stack spacing={1.5} alignItems="center">
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                        No vouchers match the current view
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('vouchers.empty')}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {hasActiveFilters ? (
                                            <Button size="small" variant="outlined" onClick={resetFilters}>
                                                Clear filters
                                            </Button>
                                        ) : null}
                                        {canWizard ? (
                                            <Button size="small" variant="contained" onClick={() => router.visit(`${adminAppUrl}/operations/vouchers/create`)}>
                                                {t('vouchers.actions.create_with_wizard')}
                                            </Button>
                                        ) : null}
                                    </Stack>
                                </Stack>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('vouchers.table.voucher')}</TableCell>
                                    <TableCell>{t('vouchers.table.date')}</TableCell>
                                    <TableCell>{t('vouchers.table.recipient')}</TableCell>
                                    <TableCell>{t('trips.labels.destination_warehouse')}</TableCell>
                                    <TableCell>{t('vouchers.table.status')}</TableCell>
                                    <TableCell align="right">{t('vouchers.table.lines')}</TableCell>
                                    <TableCell align="right">{t('vouchers.table.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {voucherRows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        hover
                                        sx={{
                                            bgcolor: needsAction(row) ? 'warning.50' : 'inherit',
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 600 }}>
                                            <Stack spacing={0.4}>
                                                <Box sx={{ fontWeight: 700 }}>
                                                    {voucherHref(row) ? <Link href={voucherHref(row)}>{row.voucher_no}</Link> : row.voucher_no}
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {warehouseLabel(row.source_warehouse) !== '—'
                                                        ? warehouseLabel(row.source_warehouse)
                                                        : warehouseLabel(row.default_to_warehouse)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{typeof row.voucher_date === 'string' ? row.voucher_date.slice(0, 10) : row.voucher_date}</TableCell>
                                        <TableCell>{recipientLabel(row)}</TableCell>
                                        <TableCell>{row.default_to_warehouse?.display_name ?? '—'}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.75} alignItems="center">
                                                <Chip size="small" label={voucherStatusLabel(row.status, t)} color={statusColor(row.status)} variant="outlined" />
                                                {needsAction(row) ? (
                                                    <Chip
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                        icon={<NotificationsIcon fontSize="small" />}
                                                        label={voucherPaymentChipLabel(row.payment_status, t)}
                                                    />
                                                ) : null}
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">{row.items?.length ?? 0}</TableCell>
                                        <TableCell align="right" sx={{ width: 56 }}>
                                            {canUseRowActions(row) && (
                                                <IconButton size="small" onClick={(e) => handleTableActionOpen(e, row)} aria-label={t('vouchers.actions.row_actions')}>
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {voucherRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                    No vouchers match the current view
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('vouchers.empty')}
                                                </Typography>
                                                <Stack direction="row" spacing={1}>
                                                    {hasActiveFilters ? (
                                                        <Button size="small" variant="outlined" onClick={resetFilters}>
                                                            Clear filters
                                                        </Button>
                                                    ) : null}
                                                    {canWizard ? (
                                                        <Button size="small" variant="contained" onClick={() => router.visit(`${adminAppUrl}/operations/vouchers/create`)}>
                                                            {t('vouchers.actions.create_with_wizard')}
                                                        </Button>
                                                    ) : null}
                                                </Stack>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                )}

                <PaginationBar
                    pagination={vouchers}
                    itemLabel="vouchers"
                    onPageChange={(page) => applyFilters({ page })}
                    onPerPageChange={(perPage) => applyFilters({ per_page: perPage, page: 1 })}
                />

                <Menu
                    anchorEl={tableActionAnchorEl}
                    open={openTableActionMenu}
                    onClose={handleTableActionClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    {selectedRow && selectedRow.status !== 'DRAFT' && canViewDetail && (
                        <MenuItem dense component={Link} href={`${adminAppUrl}/operations/vouchers/${selectedRow.id}`} onClick={handleTableActionClose}>
                            {t('vouchers.actions.view_details')}
                        </MenuItem>
                    )}
                    {selectedRow?.status === 'DRAFT' && canWizard && (
                        <MenuItem dense onClick={() => selectedRow && goEditDraft(selectedRow)}>
                            {t('vouchers.actions.edit_in_wizard')}
                        </MenuItem>
                    )}
                    {selectedRow?.status === 'DRAFT' && canManage && !canWizard && (
                        <MenuItem dense disabled>
                            {t('vouchers.actions.edit_requires_inventory_manage')}
                        </MenuItem>
                    )}
                    {selectedRow && canMarkAsPaid(selectedRow) && (
                        <MenuItem dense onClick={() => selectedRow && markAsPaid(selectedRow)}>
                            {t('vouchers.actions.mark_as_paid')}
                        </MenuItem>
                    )}
                    {(selectedRow?.status === 'DRAFT' || selectedRow?.status === 'CONFIRMED') && (
                        <MenuItem dense sx={{ color: 'error.main' }} onClick={() => selectedRow && removeRow(selectedRow)}>
                            {selectedRow?.status === 'DRAFT' ? t('ui.delete') : t('vouchers.actions.safe_delete')}
                        </MenuItem>
                    )}
                </Menu>
            </Stack>
        </AdminLayout>
    );
}
