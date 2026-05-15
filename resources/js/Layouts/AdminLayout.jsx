import { useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AppBar,
    Badge,
    Box,
    CssBaseline,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    ThemeProvider,
    Toolbar,
    Typography,
    createTheme,
    useMediaQuery,
} from '@mui/material';
import {
    AccountCircle,
    AdminPanelSettings as AdminPanelSettingsIcon,
    AdminPanelSettingsOutlined as AdminPanelSettingsOutlinedIcon,
    AutoAwesomeMosaic as UiShowcaseIcon,
    AutoAwesomeMosaicOutlined as UiShowcaseOutlinedIcon,
    Dashboard as DashboardIcon,
    DashboardOutlined as DashboardOutlinedIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Person as PersonIcon,
    PersonOutlined as PersonOutlinedIcon,
    Inventory2 as ProductIcon,
    Inventory2Outlined as ProductOutlinedIcon,
    LocalShipping as VehicleIcon,
    LocalShippingOutlined as VehicleOutlinedIcon,
    Storefront as MerchantIcon,
    StorefrontOutlined as MerchantOutlinedIcon,
    Storage as StockIcon,
    StorageOutlined as StockOutlinedIcon,
    Warehouse as WarehouseIcon,
    WarehouseOutlined as WarehouseOutlinedIcon,
    ReceiptLong as VoucherIcon,
    ReceiptLongOutlined as VoucherOutlinedIcon,
    AltRoute as TripRouteIcon,
    AltRouteOutlined as TripRouteOutlinedIcon,
    MoveToInbox as FulfillmentInboxIcon,
    MoveToInboxOutlined as FulfillmentInboxOutlinedIcon,
    Insights as FinanceReportsIcon,
    InsightsOutlined as FinanceReportsOutlinedIcon,
    Settings as SettingsIcon,
    Label as LabelIcon,
    LabelOutlined as LabelOutlinedIcon,
    SettingsOutlined as SettingsOutlinedIcon,
} from '@mui/icons-material';


const drawerWidth = 208;
const drawerWidthCollapsed = 64;

export default function AdminLayout({ children, title = 'Admin Panel' }) {
    const { url, props } = usePage();
    const adminAppUrl = props.admin_app_url;
    const authUser = props.auth?.user;
    const permissionCodes = props.auth?.permission_codes ?? [];
    const fulfillmentInboxPending = props.nav_counts?.fulfillment_inbox_pending ?? 0;
    const fulfillmentIncoming = props.nav_counts?.fulfillment_incoming ?? 0;
    const vouchersPending = props.nav_counts?.vouchers_pending ?? 0;
    const tripsPending = props.nav_counts?.trips_pending ?? 0;
    const [desktopOpen, setDesktopOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [dark, setDark] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('admin-color-mode') === 'dark';
    });

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: dark ? 'dark' : 'light',
                    primary: { main: '#3b82f6' },
                    background: {
                        default: dark ? '#0f172a' : '#f3f4f6',
                        paper: dark ? '#111827' : '#ffffff',
                    },
                },
                shape: { borderRadius: 8 },
                components: {
                    MuiPaper: {
                        defaultProps: {
                            elevation: 0,
                            variant: 'outlined',
                        },
                        styleOverrides: {
                            root: {
                                borderColor: dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.1)',
                            },
                        },
                    },
                    MuiCard: {
                        defaultProps: {
                            elevation: 0,
                            variant: 'outlined',
                        },
                        styleOverrides: {
                            root: {
                                borderColor: dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.1)',
                            },
                        },
                    },
                    MuiTextField: {
                        defaultProps: {
                            size: 'small',
                        },
                    },
                    MuiOutlinedInput: {
                        styleOverrides: {
                            root: {
                                borderRadius: 10,
                            },
                        },
                    },
                    MuiButton: {
                        defaultProps: {
                            size: 'small',
                            disableElevation: true,
                        },
                        styleOverrides: {
                            root: {
                                textTransform: 'none',
                                fontWeight: 600,
                                borderRadius: 10,
                            },
                        },
                    },
                },
            }),
        [dark],
    );

    const drawerScrollbarSx = useMemo(() => {
        const thumb = dark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.20)';
        const thumbHover = dark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(15, 23, 42, 0.32)';
        return {
            scrollbarWidth: 'thin',
            scrollbarColor: `${thumb} transparent`,
            '&::-webkit-scrollbar': {
                width: 10,
            },
            '&::-webkit-scrollbar-track': {
                background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: thumb,
                borderRadius: 999,
                border: '3px solid transparent',
                backgroundClip: 'content-box',
            },
            '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: thumbHover,
            },
        };
    }, [dark]);

    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const toggleTheme = () => {
        setDark((prev) => {
            const next = !prev;
            window.localStorage.setItem('admin-color-mode', next ? 'dark' : 'light');
            return next;
        });
    };
    const toggleNavigation = () => {
        if (isMobile) {
            setMobileOpen((prev) => !prev);
            return;
        }
        setDesktopOpen((prev) => !prev);
    };

    const badgeLabel = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        if (n >= 100) return '99+';
        return String(n);
    };

    const navIcon = (item, active) => {
        const label = badgeLabel(item.badgeCount);
        const baseIcon = active ? item.icon : item.iconOutlined;
        const icon = baseIcon ?? item.icon;
        const iconNode = (
            <Box
                component="span"
                sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    '& svg': {
                        fontSize: 19,
                        color: active ? 'primary.main' : 'text.secondary',
                    },
                }}
            >
                {icon}
            </Box>
        );
        if (!label) return iconNode;
        return (
            <Badge color="error" variant="standard" badgeContent={label} overlap="circular">
                {iconNode}
            </Badge>
        );
    };

    const navItemButtonSx = {
        borderRadius: 1.5,
        minHeight: 36,
        px: 1,
        '&.Mui-selected': {
            bgcolor: 'action.selected',
        },
        '&.Mui-selected:hover': {
            bgcolor: 'action.selected',
        },
    };

    const navGroups = [
        {
            title: 'Dashboard',
            items: [{ label: 'Dashboard', href: `${adminAppUrl}/dashboard`, icon: <DashboardIcon />, iconOutlined: <DashboardOutlinedIcon /> }],
        },
        {
            title: 'Operations',
            items: [
                ...(permissionCodes.includes('vouchers.view') || permissionCodes.includes('vouchers.manage')
                    ? [
                          {
                              label: 'Vouchers',
                              href: `${adminAppUrl}/operations/vouchers`,
                              icon: <VoucherIcon />,
                              iconOutlined: <VoucherOutlinedIcon />,
                              badgeCount: vouchersPending,
                          },
                      ]
                    : []),
                ...(permissionCodes.includes('trips.view') || permissionCodes.includes('trips.manage')
                    ? [
                          {
                              label: 'Fulfillment Incoming',
                              href: `${adminAppUrl}/operations/fulfillment/incoming`,
                              icon: <FulfillmentInboxIcon />,
                              iconOutlined: <FulfillmentInboxOutlinedIcon />,
                              badgeCount: fulfillmentIncoming,
                          },
                          {
                              label: 'Fulfillment Inbox',
                              href: `${adminAppUrl}/operations/fulfillment/inbox`,
                              icon: <FulfillmentInboxIcon />,
                              iconOutlined: <FulfillmentInboxOutlinedIcon />,
                              badgeCount: fulfillmentInboxPending,
                          },
                          {
                              label: 'Trips',
                              href: `${adminAppUrl}/operations/trips`,
                              icon: <TripRouteIcon />,
                              iconOutlined: <TripRouteOutlinedIcon />,
                              badgeCount: tripsPending,
                          },
                      ]
                    : []),
            ],
        },
        {
            title: 'Inventory',
            items: [
                ...(permissionCodes.includes('inventory.view') || permissionCodes.includes('inventory.manage')
                    ? [{ label: 'Stock', href: `${adminAppUrl}/inventory/stocks`, icon: <StockIcon />, iconOutlined: <StockOutlinedIcon /> }]
                    : []),
            ],
        },
        {
            title: 'Finance',
            items: [
                ...(permissionCodes.includes('finance.view') || permissionCodes.includes('finance.manage')
                    ? [
                          {
                              label: 'Finance Reports',
                              href: `${adminAppUrl}/finance/reports`,
                              icon: <FinanceReportsIcon />,
                              iconOutlined: <FinanceReportsOutlinedIcon />,
                          },
                          {
                              label: 'Finance Ledger',
                              href: `${adminAppUrl}/finance/ledger`,
                              icon: <VoucherIcon />,
                              iconOutlined: <VoucherOutlinedIcon />,
                          },
                      ]
                    : []),
                ...(permissionCodes.includes('finance.manage')
                    ? [
                          {
                              label: 'Finance Categories',
                              href: `${adminAppUrl}/finance/categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
            ],
        },
        {
            title: 'Master Data',
            items: [
                ...(permissionCodes.includes('warehouses.view') || permissionCodes.includes('warehouses.manage')
                    ? [{ label: 'Warehouses', href: `${adminAppUrl}/master/warehouses`, icon: <WarehouseIcon />, iconOutlined: <WarehouseOutlinedIcon /> }]
                    : []),
                ...(permissionCodes.includes('inventory.view') || permissionCodes.includes('inventory.manage')
                    ? [
                          { label: 'Products', href: `${adminAppUrl}/master/products`, icon: <ProductIcon />, iconOutlined: <ProductOutlinedIcon /> },
                          { label: 'Merchants', href: `${adminAppUrl}/master/merchants`, icon: <MerchantIcon />, iconOutlined: <MerchantOutlinedIcon /> },
                          { label: 'Vehicles', href: `${adminAppUrl}/master/vehicles`, icon: <VehicleIcon />, iconOutlined: <VehicleOutlinedIcon /> },
                      ]
                    : []),
                ...(permissionCodes.includes('vouchers.manage')
                    ? [
                          {
                              label: 'Voucher Cost Categories',
                              href: `${adminAppUrl}/master/voucher-additional-cost-categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
                ...(permissionCodes.includes('trips.manage')
                    ? [
                          {
                              label: 'Trip Cost Categories',
                              href: `${adminAppUrl}/master/trip-cost-categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
            ],
        },
        {
            title: 'System',
            items: [
                ...(permissionCodes.includes('public_page.manage')
                    ? [{ label: 'Settings', href: `${adminAppUrl}/system/organization-settings?tab=settings`, icon: <SettingsIcon />, iconOutlined: <SettingsOutlinedIcon /> }]
                    : []),
                { label: 'Users', href: `${adminAppUrl}/iam/users`, icon: <AdminPanelSettingsIcon />, iconOutlined: <AdminPanelSettingsOutlinedIcon /> },
                { label: 'Roles', href: `${adminAppUrl}/iam/roles`, icon: <AdminPanelSettingsIcon />, iconOutlined: <AdminPanelSettingsOutlinedIcon /> },
                { label: 'UI Showcase', href: `${adminAppUrl}/ui-showcase`, icon: <UiShowcaseIcon />, iconOutlined: <UiShowcaseOutlinedIcon /> },
            ],
        },
        {
            title: 'Account',
            items: [{ label: 'Profile', href: `${adminAppUrl}/profile`, icon: <PersonIcon />, iconOutlined: <PersonOutlinedIcon /> }],
        },
    ].filter((group) => group.items.length > 0);

    const currentPath = url.split('?')[0];
    const isActive = (href) => {
        try {
            const path = new URL(href).pathname;
            return currentPath === path || currentPath.startsWith(`${path}/`);
        } catch {
            return false;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                <CssBaseline />

                <AppBar
                    position="fixed"
                    color="default"
                    elevation={0}
                    sx={{
                        zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1,
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Toolbar variant="dense" sx={{ minHeight: 48 }}>
                        <IconButton onClick={toggleNavigation} edge="start" sx={{ mr: 1 }}>
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                            {title}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <IconButton onClick={toggleTheme} size="small">
                                {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                            </IconButton>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}
                            >
                                {authUser?.name || 'Admin'}
                            </Typography>
                            <IconButton size="small">
                                <AccountCircle fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={() => router.post(`${adminAppUrl}/logout`)}
                                title="Logout"
                            >
                                <LogoutIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    </Toolbar>
                </AppBar>

                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            overflowY: 'auto',
                            ...drawerScrollbarSx,
                        },
                    }}
                >
                    <Toolbar variant="dense" sx={{ minHeight: 48 }} />
                    <Box sx={{ py: 0.75 }}>
                        {navGroups.map((group, idx) => (
                            <Box key={`mobile-${group.title}`}>
                                <Typography
                                    variant="overline"
                                    sx={{ px: 1.5, py: 0.75, display: 'block', color: 'text.secondary', fontWeight: 800, fontSize: 11 }}
                                >
                                    {group.title}
                                </Typography>
                                <List dense disablePadding>
                                    {group.items.map((item) => (
                                        <ListItem key={`mobile-${item.label}`} disablePadding sx={{ px: 0.75, py: 0.15 }}>
                                            <ListItemButton
                                                component={Link}
                                                href={item.href}
                                                selected={isActive(item.href)}
                                                onClick={() => setMobileOpen(false)}
                                                sx={navItemButtonSx}
                                            >
                                                <ListItemIcon sx={{ minWidth: 0, mr: 1.25, justifyContent: 'center' }}>
                                                    {navIcon(item, isActive(item.href))}
                                                </ListItemIcon>
                                                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 12.5 }} />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                                {idx < navGroups.length - 1 && <Divider sx={{ mx: 1.25, my: 0.75 }} />}
                            </Box>
                        ))}
                    </Box>
                </Drawer>

                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        width: desktopOpen ? drawerWidth : drawerWidthCollapsed,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: desktopOpen ? drawerWidth : drawerWidthCollapsed,
                            boxSizing: 'border-box',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            transition: 'width 0.2s ease',
                            ...drawerScrollbarSx,
                        },
                    }}
                >
                    <Toolbar variant="dense" sx={{ minHeight: 48 }} />
                    <Box sx={{ py: 0.75 }}>
                        {navGroups.map((group, idx) => (
                            <Box key={group.title}>
                                {desktopOpen && (
                                    <Typography
                                        variant="overline"
                                        sx={{ px: 1.5, py: 0.75, display: 'block', color: 'text.secondary', fontWeight: 800, fontSize: 11 }}
                                    >
                                        {group.title}
                                    </Typography>
                                )}
                                <List dense disablePadding>
                                    {group.items.map((item) => (
                                        <ListItem key={item.label} disablePadding sx={{ px: 0.75, py: 0.15 }}>
                                            <ListItemButton
                                                component={Link}
                                                href={item.href}
                                                selected={isActive(item.href)}
                                                sx={navItemButtonSx}
                                            >
                                                <ListItemIcon sx={{ minWidth: 0, mr: desktopOpen ? 1.25 : 0, justifyContent: 'center' }}>
                                                    {navIcon(item, isActive(item.href))}
                                                </ListItemIcon>
                                                {desktopOpen && <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 12.5 }} />}
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                                {idx < navGroups.length - 1 && <Divider sx={{ mx: 1.25, my: 0.75 }} />}
                            </Box>
                        ))}
                    </Box>
                </Drawer>

                <Box
                    component="main"
                    sx={{ flexGrow: 1, pt: 7, px: { xs: 1.25, sm: 2 }, pb: { xs: 1.25, sm: 2 }, bgcolor: 'background.default' }}
                >
                    {children}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
