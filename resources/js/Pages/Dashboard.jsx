import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import {
    AddCircleOutlineOutlined as AddIcon,
    InsightsOutlined as InsightsIcon,
    ReceiptLongOutlined as VoucherIcon,
    AltRouteOutlined as TripIcon,
    Inventory2Outlined as InventoryIcon,
    AccountBalanceWalletOutlined as LedgerIcon,
    WarehouseOutlined as WarehouseIcon,
} from '@mui/icons-material';

export default function Dashboard() {
    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const permissionCodes = pageProps.auth?.permission_codes ?? [];
    const navCounts = pageProps.nav_counts ?? {};

    const can = (code) => permissionCodes.includes(code);
    const canAny = (...codes) => codes.some((c) => can(c));

    const canViewVouchers = canAny('vouchers.view', 'vouchers.manage');
    const canManageVouchers = can('vouchers.manage') && can('inventory.manage');
    const canViewTrips = canAny('trips.view', 'trips.manage');
    const canManageTrips = can('trips.manage');
    const canManagePayments = can('payments.manage');
    const canViewFinance = canAny('finance.view', 'finance.manage');
    const canManageFinance = can('finance.manage');
    const canViewInventory = canAny('inventory.view', 'inventory.manage');
    const canViewWarehouses = canAny('warehouses.view', 'warehouses.manage');

    const cards = [
        canViewVouchers
            ? {
                  key: 'vouchers-pending',
                  title: 'Vouchers pending',
                  value: navCounts.vouchers_pending ?? 0,
                  description: 'Unpaid / partial vouchers.',
                  href: `${adminAppUrl}/operations/vouchers`,
                  icon: <VoucherIcon />,
              }
            : null,
        canViewTrips
            ? {
                  key: 'trips-pending',
                  title: 'Active trips',
                  value: navCounts.trips_pending ?? 0,
                  description: 'Trips not completed.',
                  href: `${adminAppUrl}/operations/trips`,
                  icon: <TripIcon />,
              }
            : null,
    ].filter(Boolean);

    const quickLinks = [
        canManageVouchers
            ? {
                  key: 'create-voucher',
                  title: 'Create voucher',
                  description: 'Start a new voucher.',
                  href: `${adminAppUrl}/operations/vouchers/create`,
                  icon: <AddIcon />,
              }
            : null,
        canManageTrips
            ? {
                  key: 'create-trip',
                  title: 'Create trip',
                  description: 'Plan a new trip and load vouchers.',
                  href: `${adminAppUrl}/operations/trips/create`,
                  icon: <AddIcon />,
              }
            : null,
        canViewFinance
            ? {
                  key: 'finance-reports',
                  title: 'Finance reports',
                  description: 'Income vs expense (monthly).',
                  href: `${adminAppUrl}/finance/reports`,
                  icon: <InsightsIcon />,
              }
            : null,
        canViewFinance
            ? {
                  key: 'finance-ledger',
                  title: 'Finance ledger',
                  description: canManageFinance ? 'Create and manage entries.' : 'View entries.',
                  href: `${adminAppUrl}/finance/ledger`,
                  icon: <LedgerIcon />,
              }
            : null,
        canViewInventory
            ? {
                  key: 'products',
                  title: 'Products',
                  description: 'Search / manage products.',
                  href: `${adminAppUrl}/master/products`,
                  icon: <InventoryIcon />,
              }
            : null,
        canViewWarehouses
            ? {
                  key: 'warehouses',
                  title: 'Warehouses',
                  description: 'Warehouse list and details.',
                  href: `${adminAppUrl}/master/warehouses`,
                  icon: <WarehouseIcon />,
              }
            : null,
    ].filter(Boolean);

    return (
        <AdminLayout title="Dashboard">
            <Head title="Dashboard" />
            <Stack spacing={2}>
                <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            Dashboard
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Quick access, notifications, and important reports.
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', pt: 0.5, rowGap: 0.75 }}>
                            {canManageTrips ? <Chip size="small" variant="outlined" label="Trips" /> : null}
                            {canViewVouchers ? <Chip size="small" variant="outlined" label="Vouchers" /> : null}
                            {canManagePayments ? <Chip size="small" variant="outlined" label="Payments" /> : null}
                            {canViewFinance ? <Chip size="small" variant="outlined" label="Finance" /> : null}
                        </Stack>
                    </Stack>
                </Paper>

                {cards.length > 0 ? (
                    <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Stack spacing={1.5}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                        Notifications
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        What needs attention right now.
                                    </Typography>
                                </Box>
                            </Stack>
                            <Grid container spacing={1.5}>
                                {cards.map((c) => (
                                    <Grid key={c.key} item xs={12} sm={6} md={3}>
                                        <Paper sx={{ p: 1.75, borderRadius: 2 }}>
                                            <Stack spacing={1.25}>
                                                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {c.title}
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.25, lineHeight: 1.1 }}>
                                                            {Number(c.value ?? 0)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ color: 'text.secondary', pt: 0.25 }}>{c.icon}</Box>
                                                </Stack>
                                                <Typography variant="body2" color="text.secondary">
                                                    {c.description}
                                                </Typography>
                                                <Button component={Link} href={c.href} variant="outlined" size="small">
                                                    Open
                                                </Button>
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Stack>
                    </Paper>
                ) : null}

                {quickLinks.length > 0 ? (
                    <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    Quick access
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Links are shown based on your role permissions.
                                </Typography>
                            </Box>
                            <Divider />
                            <Grid container spacing={1.5}>
                                {quickLinks.map((l) => (
                                    <Grid key={l.key} item xs={12} sm={6} md={4}>
                                        <Paper sx={{ p: 1.75, borderRadius: 2 }}>
                                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                                                <Box sx={{ pt: 0.25, color: 'text.secondary' }}>{l.icon}</Box>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                        {l.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {l.description}
                                                    </Typography>
                                                    <Box sx={{ mt: 1 }}>
                                                        <Button component={Link} href={l.href} variant="contained" size="small">
                                                            Go
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Stack>
                    </Paper>
                ) : null}
            </Stack>
        </AdminLayout>
    );
}
