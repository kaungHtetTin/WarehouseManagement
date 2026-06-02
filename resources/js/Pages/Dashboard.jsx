import PageHeader from '@/Components/PageHeader';
import AdminLayout from '@/Layouts/AdminLayout';
import { useT } from '@/i18n';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AddCircleOutlineOutlined as AddIcon,
    AccountBalanceWalletOutlined as LedgerIcon,
    AltRouteOutlined as TripIcon,
    ArrowForwardOutlined as ArrowIcon,
    HistoryOutlined as ActivityLogIcon,
    ReceiptLongOutlined as VoucherIcon,
    WarehouseOutlined as WarehouseIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';

const operationGridColumns = {
    xs: 'minmax(0, 1fr) auto',
    sm: 'minmax(0, 1fr) 90px 116px',
};

function OperationRow({ item }) {
    return (
        <Box
            component={Link}
            href={item.href}
            sx={{
                display: 'grid',
                gridTemplateColumns: operationGridColumns,
                gap: 1.5,
                alignItems: 'center',
                px: { xs: 1.5, sm: 2 },
                py: 1.35,
                color: 'text.primary',
                textDecoration: 'none',
                borderTop: 1,
                borderColor: 'divider',
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        display: 'grid',
                        flexShrink: 0,
                        placeItems: 'center',
                        borderRadius: 1.5,
                        bgcolor: 'action.hover',
                        color: `${item.tone}.main`,
                        '& svg': { fontSize: 20 },
                    }}
                >
                    {item.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {item.subtitle}
                    </Typography>
                </Box>
            </Stack>

            <Typography variant="h6" sx={{ justifySelf: 'end', fontWeight: 900, color: `${item.tone}.main` }}>
                {item.value}
            </Typography>

            <Typography
                variant="caption"
                color="primary.main"
                sx={{ display: { xs: 'none', sm: 'block' }, justifySelf: 'end', fontWeight: 800 }}
            >
                {item.openLabel}
            </Typography>
        </Box>
    );
}

function WorkspaceLink({ item }) {
    return (
        <Box
            component={Link}
            href={item.href}
            sx={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
                px: 1.5,
                py: 1.25,
                color: 'text.primary',
                textDecoration: 'none',
                borderTop: 1,
                borderColor: 'divider',
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Box sx={{ display: 'grid', placeItems: 'center', color: 'primary.main', '& svg': { fontSize: 20 } }}>{item.icon}</Box>
            <Typography variant="body2" sx={{ minWidth: 0, fontWeight: 700 }}>
                {item.label}
            </Typography>
            <ArrowIcon sx={{ color: 'text.disabled', fontSize: 17 }} />
        </Box>
    );
}

export default function Dashboard() {
    const pageProps = usePage().props;
    const t = useT();
    const adminAppUrl = pageProps.admin_app_url;
    const permissionCodes = pageProps.auth?.permission_codes ?? [];
    const navCounts = pageProps.nav_counts ?? {};

    const can = (code) => permissionCodes.includes(code);
    const canAny = (...codes) => codes.some((code) => can(code));

    const canViewVouchers = canAny('vouchers.view', 'vouchers.manage');
    const canManageVouchers = can('vouchers.manage') && can('inventory.manage');
    const canViewTrips = canAny('trips.view', 'trips.manage');
    const canManageTrips = can('trips.manage');
    const canViewFinance = canAny('finance.view', 'finance.manage');
    const canViewWarehouses = canAny('warehouses.view', 'warehouses.manage');

    const operations = [
        canViewVouchers
            ? {
                  title: t('dashboard.ops.vouchers_pending'),
                  subtitle: t('dashboard.ops.vouchers_pending_sub'),
                  openLabel: t('dashboard.table.open_list'),
                  value: Number(navCounts.vouchers_pending ?? 0),
                  href: `${adminAppUrl}/operations/vouchers`,
                  icon: <VoucherIcon />,
                  tone: 'warning',
              }
            : null,
        canViewTrips
            ? {
                  title: t('dashboard.ops.active_trips'),
                  subtitle: t('dashboard.ops.active_trips_sub'),
                  openLabel: t('dashboard.table.open_list'),
                  value: Number(navCounts.trips_pending ?? 0),
                  href: `${adminAppUrl}/operations/trips`,
                  icon: <TripIcon />,
                  tone: 'primary',
              }
            : null,
    ].filter(Boolean);

    const workspaces = [
        canViewVouchers ? { label: t('nav.vouchers'), href: `${adminAppUrl}/operations/vouchers`, icon: <VoucherIcon /> } : null,
        canViewTrips ? { label: t('nav.trips'), href: `${adminAppUrl}/operations/trips`, icon: <TripIcon /> } : null,
        canViewFinance ? { label: t('nav.finance_ledger'), href: `${adminAppUrl}/finance/ledger`, icon: <LedgerIcon /> } : null,
        canViewFinance ? { label: t('nav.finance_reports'), href: `${adminAppUrl}/finance/reports`, icon: <LedgerIcon /> } : null,
        canViewWarehouses ? { label: t('nav.warehouses'), href: `${adminAppUrl}/master/warehouses`, icon: <WarehouseIcon /> } : null,
        can('activity_logs.view') ? { label: t('nav.activity_logs'), href: `${adminAppUrl}/system/activity-logs`, icon: <ActivityLogIcon /> } : null,
    ].filter(Boolean);

    const totalAttention = operations.reduce((total, operation) => total + operation.value, 0);

    return (
        <AdminLayout title={t('dashboard.title')}>
            <Head title={t('dashboard.title')} />

            <Box sx={{ pb: { xs: 9, md: 0 } }}>
                <PageHeader
                    title={t('dashboard.title')}
                    subtitle={t('dashboard.subtitle')}
                    actions={
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            {canManageVouchers ? (
                                <Button component={Link} href={`${adminAppUrl}/operations/vouchers/create`} variant="contained" startIcon={<AddIcon />}>
                                    {t('dashboard.quick_links.create_voucher.title')}
                                </Button>
                            ) : null}
                            {canManageTrips ? (
                                <Button component={Link} href={`${adminAppUrl}/operations/trips/create`} variant="outlined" startIcon={<TripIcon />}>
                                    {t('dashboard.quick_links.create_trip.title')}
                                </Button>
                            ) : null}
                        </Stack>
                    }
                />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)' }, gap: 1.5, mt: 1.5 }}>
                    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5 }}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    {t('dashboard.notifications.title')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('dashboard.notifications.subtitle')}
                                </Typography>
                            </Box>
                            <Chip
                                size="small"
                                color={totalAttention > 0 ? 'warning' : 'success'}
                                variant={totalAttention > 0 ? 'filled' : 'outlined'}
                                label={totalAttention > 0 ? `${totalAttention} ${t('dashboard.hero.needs_attention')}` : t('dashboard.hero.all_clear')}
                            />
                        </Stack>

                        <Box
                            sx={{
                                display: { xs: 'none', sm: 'grid' },
                                gridTemplateColumns: operationGridColumns,
                                gap: 1.5,
                                px: 2,
                                py: 0.75,
                                borderTop: 1,
                                borderColor: 'divider',
                                bgcolor: 'action.hover',
                            }}
                        >
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                                {t('dashboard.table.operation')}
                            </Typography>
                            <Typography variant="overline" color="text.secondary" sx={{ justifySelf: 'end', fontWeight: 800 }}>
                                {t('dashboard.table.count')}
                            </Typography>
                            <Typography variant="overline" color="text.secondary" sx={{ justifySelf: 'end', fontWeight: 800 }}>
                                {t('dashboard.table.action')}
                            </Typography>
                        </Box>

                        {operations.map((operation) => (
                            <OperationRow key={operation.title} item={operation} />
                        ))}
                    </Paper>

                    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
                        <Box sx={{ px: 1.5, py: 1.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {t('dashboard.workspace.title')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('dashboard.workspace.subtitle')}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'minmax(0, 1fr)' } }}>
                            {workspaces.map((workspace) => (
                                <WorkspaceLink key={workspace.href} item={workspace} />
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </AdminLayout>
    );
}
