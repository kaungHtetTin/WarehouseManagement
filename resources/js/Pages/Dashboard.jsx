import AdminLayout from '@/Layouts/AdminLayout';
import DashboardDecor from '@/Components/Dashboard/DashboardDecor';
import KpiStatCard from '@/Components/Dashboard/KpiStatCard';
import PageHeader from '@/Components/PageHeader';
import { Head, Link, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    Stack,
    Typography,
    useTheme,
} from '@mui/material';
import {
    AddCircleOutlineOutlined as AddIcon,
    AccountBalanceWalletOutlined as LedgerIcon,
    AltRouteOutlined as TripIcon,
    CheckCircleOutlineOutlined as ReadyIcon,
    CategoryOutlined as CategoryIcon,
    PendingActionsOutlined as PendingIcon,
    ReceiptLongOutlined as VoucherIcon,
    SettingsOutlined as SettingsIcon,
    StorefrontOutlined as MerchantIcon,
    TimeToLeaveOutlined as VehicleIcon,
    WarehouseOutlined as WarehouseIcon,
} from '@mui/icons-material';
import { dashboardTokens } from '@/theme/adminDashboardTheme';

export default function Dashboard() {
    const pageProps = usePage().props;
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const tokens = dark ? dashboardTokens.dark : dashboardTokens.light;
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
    const canViewInventory = canAny('inventory.view', 'inventory.manage');
    const canViewWarehouses = canAny('warehouses.view', 'warehouses.manage');
    const canManageSettings = can('public_page.manage');

    const vouchersPending = Number(navCounts.vouchers_pending ?? 0);
    const tripsPending = Number(navCounts.trips_pending ?? 0);
    const totalAttention = vouchersPending + tripsPending;

    const stats = [
        canViewVouchers
            ? {
                  title: t('dashboard.ops.vouchers_pending'),
                  value: vouchersPending,
                  subtitle: t('dashboard.ops.vouchers_pending_sub'),
                  tone: vouchersPending > 0 ? 'warning' : 'success',
                  icon: <PendingIcon />,
                  href: `${adminAppUrl}/operations/vouchers`,
              }
            : null,
        canViewTrips
            ? {
                  title: t('dashboard.ops.active_trips'),
                  value: tripsPending,
                  subtitle: t('dashboard.ops.active_trips_sub'),
                  tone: 'primary',
                  icon: <TripIcon />,
                  href: `${adminAppUrl}/operations/trips`,
              }
            : null,
    ].filter(Boolean);

    const quickActions = [
        canManageVouchers
            ? {
                  title: t('dashboard.quick_links.create_voucher.title'),
                  description: t('dashboard.quick_links.create_voucher.description'),
                  href: `${adminAppUrl}/operations/vouchers/create`,
                  icon: <AddIcon />,
              }
            : null,
        canManageTrips
            ? {
                  title: t('dashboard.quick_links.create_trip.title'),
                  description: t('dashboard.quick_links.create_trip.description'),
                  href: `${adminAppUrl}/operations/trips/create`,
                  icon: <TripIcon />,
              }
            : null,
        canViewFinance
            ? {
                  title: t('dashboard.quick_links.finance_reports.title'),
                  description: t('dashboard.quick_links.finance_reports.description'),
                  href: `${adminAppUrl}/finance/reports`,
                  icon: <LedgerIcon />,
              }
            : null,
        canViewFinance
            ? {
                  title: t('dashboard.quick_links.finance_ledger.title'),
                  description: t('dashboard.quick_links.finance_ledger.view'),
                  href: `${adminAppUrl}/finance/ledger`,
                  icon: <LedgerIcon />,
              }
            : null,
        canViewInventory
            ? {
                  title: t('nav.merchants'),
                  description: t('dashboard.quick_links.merchants.description'),
                  href: `${adminAppUrl}/master/merchants`,
                  icon: <MerchantIcon />,
              }
            : null,
        canViewInventory
            ? {
                  title: t('nav.vehicles'),
                  description: t('dashboard.quick_links.vehicles.description'),
                  href: `${adminAppUrl}/master/vehicles`,
                  icon: <VehicleIcon />,
              }
            : null,
        canViewWarehouses
            ? {
                  title: t('dashboard.quick_links.warehouses.title'),
                  description: t('dashboard.quick_links.warehouses.description'),
                  href: `${adminAppUrl}/master/warehouses`,
                  icon: <WarehouseIcon />,
              }
            : null,
        can('vouchers.manage')
            ? {
                  title: t('nav.voucher_cost_categories'),
                  description: t('dashboard.quick_links.voucher_cost_categories.description'),
                  href: `${adminAppUrl}/master/voucher-additional-cost-categories`,
                  icon: <CategoryIcon />,
              }
            : null,
        canManageTrips
            ? {
                  title: t('nav.trip_cost_categories'),
                  description: t('dashboard.quick_links.trip_cost_categories.description'),
                  href: `${adminAppUrl}/master/trip-cost-categories`,
                  icon: <CategoryIcon />,
              }
            : null,
        canManageSettings
            ? {
                  title: t('nav.settings'),
                  description: t('dashboard.quick_links.settings.description'),
                  href: `${adminAppUrl}/system/organization-settings`,
                  icon: <SettingsIcon />,
              }
            : null,
    ].filter(Boolean);

    const workspaceLinks = [
        canViewVouchers
            ? { label: t('nav.vouchers'), description: t('dashboard.workspace.vouchers'), href: `${adminAppUrl}/operations/vouchers`, icon: <VoucherIcon /> }
            : null,
        canViewTrips
            ? { label: t('nav.trips'), description: t('dashboard.workspace.trips'), href: `${adminAppUrl}/operations/trips`, icon: <TripIcon /> }
            : null,
        canViewFinance
            ? { label: t('nav.finance'), description: t('dashboard.workspace.finance'), href: `${adminAppUrl}/finance/ledger`, icon: <LedgerIcon /> }
            : null,
        canViewInventory
            ? { label: t('nav.merchants'), description: t('dashboard.quick_links.merchants.description'), href: `${adminAppUrl}/master/merchants`, icon: <MerchantIcon /> }
            : null,
        canViewWarehouses
            ? { label: t('dashboard.quick_links.warehouses.title'), description: t('dashboard.workspace.warehouses'), href: `${adminAppUrl}/master/warehouses`, icon: <WarehouseIcon /> }
            : null,
    ].filter(Boolean);

    const alerts = [
        canViewVouchers && vouchersPending > 0
            ? { title: t('dashboard.ops.vouchers_pending'), detail: t('dashboard.alerts.vouchers'), href: `${adminAppUrl}/operations/vouchers`, tone: 'warning' }
            : null,
        canViewTrips && tripsPending > 0
            ? { title: t('dashboard.ops.active_trips'), detail: t('dashboard.alerts.trips'), href: `${adminAppUrl}/operations/trips`, tone: 'primary' }
            : null,
    ].filter(Boolean);

    const todayFocus = [
        canManageVouchers
            ? {
                  title: vouchersPending > 0 ? 'Review pending vouchers' : 'Create a new voucher',
                  detail:
                      vouchersPending > 0
                          ? `${vouchersPending} voucher${vouchersPending === 1 ? '' : 's'} currently need attention.`
                          : 'Start a new shipment flow and keep today moving.',
                  href: vouchersPending > 0 ? `${adminAppUrl}/operations/vouchers` : `${adminAppUrl}/operations/vouchers/create`,
                  tone: vouchersPending > 0 ? 'warning.main' : 'primary.main',
              }
            : null,
        canManageTrips
            ? {
                  title: tripsPending > 0 ? 'Check active trips' : 'Plan the next trip',
                  detail:
                      tripsPending > 0
                          ? `${tripsPending} trip${tripsPending === 1 ? '' : 's'} are still active or waiting for updates.`
                          : 'Prepare dispatch capacity before the next loading cycle.',
                  href: tripsPending > 0 ? `${adminAppUrl}/operations/trips` : `${adminAppUrl}/operations/trips/create`,
                  tone: 'primary.main',
              }
            : null,
        canViewFinance
            ? {
                  title: 'Review finance movement',
                  detail: "Open the ledger and validate today's operational financial entries.",
                  href: `${adminAppUrl}/finance/ledger`,
                  tone: 'success.main',
              }
            : null,
    ].filter(Boolean);

    const workspaceSummary = [
        { label: 'Attention items', value: totalAttention, tone: totalAttention > 0 ? 'warning.main' : 'success.main' },
        { label: 'Quick actions', value: quickActions.length, tone: 'primary.main' },
        { label: 'Workspaces', value: workspaceLinks.length, tone: 'secondary.main' },
    ];

    return (
        <AdminLayout title={t('dashboard.title')}>
            <Head title={t('dashboard.title')} />
            <DashboardDecor dark={dark} />

            <Box sx={{ position: 'relative', zIndex: 1, pb: { xs: 9, md: 0 } }}>
                <PageHeader
                    eyebrow={t('dashboard.hero.badge')}
                    title={t('dashboard.hero.title')}
                    subtitle={t('dashboard.subtitle')}
                    sx={{
                        mb: 3,
                        position: 'relative',
                        overflow: 'hidden',
                        background: tokens.gradientPrimary,
                        color: '#fff',
                        border: 'none',
                        boxShadow: '0 20px 50px rgba(79, 70, 229, 0.30)',
                        '& .MuiTypography-root': { color: '#fff' },
                        '& .MuiTypography-body2': { color: 'rgba(255,255,255,0.92)' },
                    }}
                    actions={
                        <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap', gap: 1 }}>
                            <Chip
                                icon={<ReadyIcon sx={{ color: '#fff !important' }} />}
                                label={totalAttention > 0 ? t('dashboard.hero.needs_attention') : t('dashboard.hero.all_clear')}
                                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 800 }}
                            />
                            {canViewVouchers ? <Chip label={t('nav.vouchers')} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} /> : null}
                            {canViewTrips ? <Chip label={t('nav.trips')} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} /> : null}
                        </Stack>
                    }
                />

                {stats.length > 0 ? (
                    <Grid container spacing={1.5} sx={{ mb: 3 }}>
                        {stats.map((stat) => (
                            <Grid key={stat.title} item xs={12} sm={6} lg={3}>
                                <KpiStatCard
                                    title={stat.title}
                                    value={stat.value}
                                    subtitle={stat.subtitle}
                                    tone={stat.tone}
                                    icon={stat.icon}
                                    href={stat.href}
                                />
                            </Grid>
                        ))}
                    </Grid>
                ) : null}

                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                    <Grid item xs={12} lg={8}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: { xs: 1.75, sm: 2 } }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            Today's Focus
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Prioritized shortcuts based on operational attention and available permissions.
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={totalAttention > 0 ? `${totalAttention} needs attention` : 'All clear'}
                                        color={totalAttention > 0 ? 'warning' : 'success'}
                                        variant={totalAttention > 0 ? 'filled' : 'outlined'}
                                    />
                                </Stack>
                                <Grid container spacing={1.5}>
                                    {todayFocus.map((item) => (
                                        <Grid key={item.title} item xs={12} md={4}>
                                            <Button
                                                component={Link}
                                                href={item.href}
                                                variant="outlined"
                                                fullWidth
                                                sx={{
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'flex-start',
                                                    textAlign: 'left',
                                                    p: 1.25,
                                                    height: '100%',
                                                    borderRadius: 2,
                                                }}
                                            >
                                                <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 800, color: item.tone }}>
                                                        {item.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {item.detail}
                                                    </Typography>
                                                </Stack>
                                            </Button>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} lg={4}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: { xs: 1.75, sm: 2 } }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    Workspace Snapshot
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    A quick view of how much action is available from this dashboard.
                                </Typography>
                                <Stack spacing={1}>
                                    {workspaceSummary.map((item) => (
                                        <Box
                                            key={item.label}
                                            sx={{
                                                p: 1.25,
                                                borderRadius: 2,
                                                bgcolor: 'action.hover',
                                                border: 1,
                                                borderColor: 'divider',
                                            }}
                                        >
                                            <Typography variant="caption" color="text.secondary">
                                                {item.label}
                                            </Typography>
                                            <Typography variant="h5" sx={{ fontWeight: 900, color: item.tone }}>
                                                {item.value}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                <Grid container spacing={1.5}>
                    <Grid item xs={12} lg={7}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            {t('dashboard.quick_access.title')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('dashboard.quick_access.subtitle')}
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Grid container spacing={1.5}>
                                    {quickActions.map((action) => (
                                        <Grid key={action.title} item xs={12} sm={6}>
                                            <Button
                                                component={Link}
                                                href={action.href}
                                                variant="outlined"
                                                fullWidth
                                                sx={{
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'flex-start',
                                                    textAlign: 'left',
                                                    p: 1.5,
                                                    height: '100%',
                                                    borderRadius: 3,
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                                    <Box sx={{ color: 'primary.main', pt: 0.15 }}>{action.icon}</Box>
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                            {action.title}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {action.description}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Button>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} lg={5}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    {t('dashboard.notifications.title')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t('dashboard.notifications.subtitle')}
                                </Typography>
                                <Stack spacing={1.25}>
                                    {alerts.length > 0 ? (
                                        alerts.map((alert) => (
                                            <Button
                                                key={alert.title}
                                                component={Link}
                                                href={alert.href}
                                                variant="text"
                                                fullWidth
                                                sx={{
                                                    justifyContent: 'flex-start',
                                                    p: 1.25,
                                                    borderRadius: 2,
                                                    bgcolor: 'action.hover',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <Box sx={{ width: '100%' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 800, color: `${alert.tone}.main` }}>
                                                        {alert.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {alert.detail}
                                                    </Typography>
                                                </Box>
                                            </Button>
                                        ))
                                    ) : (
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}>
                                            <ReadyIcon color="success" />
                                            <Typography variant="body2" sx={{ fontWeight: 800, mt: 0.75 }}>
                                                {t('dashboard.notify.all_clear')}
                                            </Typography>
                                        </Box>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Card>
                            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    {t('dashboard.workspace.title')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t('dashboard.workspace.subtitle')}
                                </Typography>
                                <Grid container spacing={1.5}>
                                    {workspaceLinks.map((item) => (
                                        <Grid key={item.label} item xs={12} sm={6} lg={4}>
                                            <Button
                                                component={Link}
                                                href={item.href}
                                                fullWidth
                                                sx={{
                                                    justifyContent: 'flex-start',
                                                    p: 1.5,
                                                    borderRadius: 3,
                                                    color: 'text.primary',
                                                    bgcolor: 'background.paper',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                                                    <Box
                                                        sx={{
                                                            width: 42,
                                                            height: 42,
                                                            borderRadius: 2.5,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            background: tokens.gradientPrimary,
                                                            color: '#fff',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {item.icon}
                                                    </Box>
                                                    <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                            {item.label}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.description}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Button>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>
        </AdminLayout>
    );
}
