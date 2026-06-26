import { useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import MobileBottomNav from '@/Components/Dashboard/MobileBottomNav';
import { createAdminDashboardTheme, glassSurface } from '@/theme/adminDashboardTheme';
import {
    AppBar,
    Avatar,
    Badge,
    Box,
    CssBaseline,
    Divider,
    Drawer,
    FormControl,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Select,
    Stack,
    ThemeProvider,
    Toolbar,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {
    KeyboardArrowDown as KeyboardArrowDownIcon,
    Check as CheckIcon,
    AdminPanelSettings as AdminPanelSettingsIcon,
    AdminPanelSettingsOutlined as AdminPanelSettingsOutlinedIcon,
    Dashboard as DashboardIcon,
    DashboardOutlined as DashboardOutlinedIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Person as PersonIcon,
    PersonOutlined as PersonOutlinedIcon,
    LocalShipping as VehicleIcon,
    LocalShippingOutlined as VehicleOutlinedIcon,
    Storefront as MerchantIcon,
    StorefrontOutlined as MerchantOutlinedIcon,
    Warehouse as WarehouseIcon,
    WarehouseOutlined as WarehouseOutlinedIcon,
    ReceiptLong as VoucherIcon,
    ReceiptLongOutlined as VoucherOutlinedIcon,
    AltRoute as TripRouteIcon,
    AltRouteOutlined as TripRouteOutlinedIcon,
    Insights as FinanceReportsIcon,
    InsightsOutlined as FinanceReportsOutlinedIcon,
    Settings as SettingsIcon,
    Label as LabelIcon,
    LabelOutlined as LabelOutlinedIcon,
    SettingsOutlined as SettingsOutlinedIcon,
    Translate as TranslateIcon,
} from '@mui/icons-material';
import { useT } from '@/i18n';


const drawerWidth = 232;
const drawerWidthCollapsed = 68;

export default function AdminLayout({ children, title = 'Admin Panel' }) {
    const { url, props } = usePage();
    const t = useT();
    const adminAppUrl = props.admin_app_url;
    const authUser = props.auth?.user;
    const permissionCodes = props.auth?.permission_codes ?? [];
    const vouchersPending = props.nav_counts?.vouchers_pending ?? 0;
    const tripsPending = props.nav_counts?.trips_pending ?? 0;
    const locale = props.i18n?.locale ?? 'en';
    const supportedLocales = props.i18n?.supported_locales ?? { en: 'English' };
    const setLocaleUrl = props.i18n?.set_locale_url;
    const [desktopOpen, setDesktopOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileAnchor, setProfileAnchor] = useState(null);
    const [dark, setDark] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('admin-color-mode') === 'dark';
    });

    const theme = useMemo(() => createAdminDashboardTheme(dark), [dark]);
    const glass = useMemo(() => glassSurface(dark), [dark]);
    const desktopDrawerWidth = desktopOpen ? drawerWidth : drawerWidthCollapsed;

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
    const can = (code) => permissionCodes.includes(code);
    const canAny = (...codes) => codes.some((code) => can(code));

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
                data-nav-icon
                sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: active ? 'action.selected' : 'transparent',
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
        position: 'relative',
        borderRadius: 1.5,
        minHeight: 36,
        px: 1,
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 16,
            borderRadius: 999,
            bgcolor: 'transparent',
        },
        '&:hover [data-nav-icon]': {
            bgcolor: 'action.hover',
            '& svg': {
                color: 'text.primary',
            },
        },
        '&.Mui-selected': {
            bgcolor: 'action.selected',
            '&::before': {
                bgcolor: 'primary.main',
            },
        },
        '&.Mui-selected:hover': {
            bgcolor: 'action.selected',
        },
    };

    const navGroups = [
        {
            title: t('nav.dashboard'),
            items: [{ label: t('nav.dashboard'), href: `${adminAppUrl}/dashboard`, icon: <DashboardIcon />, iconOutlined: <DashboardOutlinedIcon /> }],
        },
        {
            title: t('nav.operations'),
            items: [
                ...(permissionCodes.includes('vouchers.view') || permissionCodes.includes('vouchers.manage')
                    ? [
                          {
                              label: t('nav.vouchers'),
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
                              label: t('nav.trips'),
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
            title: t('nav.finance'),
            items: [
                ...(permissionCodes.includes('finance.view') || permissionCodes.includes('finance.manage')
                    ? [
                          {
                              label: t('nav.finance_reports'),
                              href: `${adminAppUrl}/finance/reports`,
                              icon: <FinanceReportsIcon />,
                              iconOutlined: <FinanceReportsOutlinedIcon />,
                          },
                          {
                              label: t('nav.finance_ledger'),
                              href: `${adminAppUrl}/finance/ledger`,
                              icon: <VoucherIcon />,
                              iconOutlined: <VoucherOutlinedIcon />,
                          },
                      ]
                    : []),
                ...(permissionCodes.includes('finance.manage')
                    ? [
                          {
                              label: t('nav.finance_categories'),
                              href: `${adminAppUrl}/finance/categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
            ],
        },
        {
            title: t('nav.master_data'),
            items: [
                ...(permissionCodes.includes('warehouses.view') || permissionCodes.includes('warehouses.manage')
                    ? [{ label: t('nav.warehouses'), href: `${adminAppUrl}/master/warehouses`, icon: <WarehouseIcon />, iconOutlined: <WarehouseOutlinedIcon /> }]
                    : []),
                ...(permissionCodes.includes('inventory.view') || permissionCodes.includes('inventory.manage')
                    ? [
                          { label: t('nav.merchants'), href: `${adminAppUrl}/master/merchants`, icon: <MerchantIcon />, iconOutlined: <MerchantOutlinedIcon /> },
                          { label: t('nav.vehicles'), href: `${adminAppUrl}/master/vehicles`, icon: <VehicleIcon />, iconOutlined: <VehicleOutlinedIcon /> },
                      ]
                    : []),
                ...(permissionCodes.includes('vouchers.manage')
                    ? [
                          {
                              label: t('nav.voucher_cost_categories'),
                              href: `${adminAppUrl}/master/voucher-additional-cost-categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
                ...(permissionCodes.includes('trips.manage')
                    ? [
                          {
                              label: t('nav.trip_cost_categories'),
                              href: `${adminAppUrl}/master/trip-cost-categories`,
                              icon: <LabelIcon />,
                              iconOutlined: <LabelOutlinedIcon />,
                          },
                      ]
                    : []),
            ],
        },
        {
            title: t('nav.system'),
            items: [
                ...(permissionCodes.includes('public_page.manage')
                    ? [{ label: t('nav.settings'), href: `${adminAppUrl}/system/organization-settings`, icon: <SettingsIcon />, iconOutlined: <SettingsOutlinedIcon /> }]
                    : []),
                ...(permissionCodes.includes('activity_logs.view')
                    ? [{ label: t('nav.activity_logs'), href: `${adminAppUrl}/system/activity-logs`, icon: <AdminPanelSettingsIcon />, iconOutlined: <AdminPanelSettingsOutlinedIcon /> }]
                    : []),
                ...(can('users.manage')
                    ? [{ label: t('nav.users'), href: `${adminAppUrl}/iam/users`, icon: <AdminPanelSettingsIcon />, iconOutlined: <AdminPanelSettingsOutlinedIcon /> }]
                    : []),
                ...(can('roles.manage')
                    ? [{ label: t('nav.roles'), href: `${adminAppUrl}/iam/roles`, icon: <AdminPanelSettingsIcon />, iconOutlined: <AdminPanelSettingsOutlinedIcon /> }]
                    : []),
            ],
        },
        {
            title: t('nav.account'),
            items: [{ label: t('nav.profile'), href: `${adminAppUrl}/profile`, icon: <PersonIcon />, iconOutlined: <PersonOutlinedIcon /> }],
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

    const drawerBrand = useMemo(() => {
        const name = authUser?.name || t('ui.admin');
        const email = authUser?.email || '';
        const profileImageUrl = authUser?.profile_image_url || null;
        const initial = String(name || '?')
            .trim()
            .slice(0, 1)
            .toUpperCase();
        return { name, email, initial, profileImageUrl };
    }, [authUser?.email, authUser?.name, authUser?.profile_image_url, t]);

    const drawerPaperBaseSx = useMemo(() => {
        const bg = dark
            ? 'linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(15,23,42,0) 32%)'
            : 'linear-gradient(180deg, rgba(79,70,229,0.08) 0%, rgba(255,255,255,0) 32%)';
        return {
            ...glass,
            borderRight: '1px solid',
            borderColor: 'divider',
            backgroundImage: bg,
            overflowY: 'auto',
            ...drawerScrollbarSx,
        };
    }, [dark, drawerScrollbarSx, glass]);

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                <CssBaseline />

                <AppBar
                    position="fixed"
                    color="default"
                    elevation={0}
                    sx={{
                        zIndex: (muiTheme) => muiTheme.zIndex.drawer - 1,
                        left: { md: desktopDrawerWidth },
                        width: { md: `calc(100% - ${desktopDrawerWidth}px)` },
                        transition: 'left 0.2s ease, width 0.2s ease',
                        ...glass,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Toolbar sx={{ minHeight: { xs: 52, sm: 60 }, px: { xs: 1, sm: 1.5 }, gap: 0.75 }}>
                        <IconButton onClick={toggleNavigation} edge="start" sx={{ mr: { xs: 0, sm: 0.5 } }}>
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, display: { xs: 'none', sm: 'block' }, mr: 1 }}>
                            {title}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <IconButton onClick={toggleTheme} size="small" sx={{ borderRadius: 2 }}>
                                {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                            </IconButton>
                            <FormControl size="small" variant="standard" sx={{ minWidth: 96, display: { xs: 'none', sm: 'block' } }}>
                                <Select
                                    value={locale}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        if (!setLocaleUrl) return;
                                        router.post(setLocaleUrl, { locale: next }, { preserveScroll: true, preserveState: true });
                                    }}
                                    disableUnderline
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        '& .MuiSelect-select': { py: 0.5, pr: 3 },
                                    }}
                                >
                                    {Object.entries(supportedLocales).map(([code, label]) => (
                                        <MenuItem key={code} value={code}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                onClick={(e) => setProfileAnchor(e.currentTarget)}
                                sx={{
                                    cursor: 'pointer',
                                    pl: 0.5,
                                    pr: 0.5,
                                    py: 0.25,
                                    borderRadius: 2,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Avatar
                                    src={drawerBrand.profileImageUrl || undefined}
                                    sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, fontWeight: 800 }}
                                >
                                    {drawerBrand.initial}
                                </Avatar>
                                <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', lineHeight: 1.2 }} noWrap>
                                        {authUser?.name || t('ui.admin')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>
                                        {authUser?.email || ''}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 32,
                                        display: { xs: 'none', sm: 'grid' },
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <KeyboardArrowDownIcon sx={{ fontSize: 20, display: 'block' }} />
                                </Box>
                            </Stack>
                            <Menu
                                anchorEl={profileAnchor}
                                open={Boolean(profileAnchor)}
                                onClose={() => setProfileAnchor(null)}
                                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                PaperProps={{
                                    sx: {
                                        mt: 1.25,
                                        minWidth: 280,
                                        maxHeight: 420,
                                        borderRadius: 4,
                                        overflowX: 'hidden',
                                        overflowY: 'auto',
                                        border: 1,
                                        borderColor: 'divider',
                                        boxShadow: dark
                                            ? '0 24px 60px rgba(0, 0, 0, 0.45)'
                                            : '0 24px 60px rgba(15, 23, 42, 0.16)',
                                        backgroundImage: dark
                                            ? 'linear-gradient(180deg, rgba(99,102,241,0.16) 0%, rgba(30,41,59,0.96) 42%)'
                                            : 'linear-gradient(180deg, rgba(79,70,229,0.10) 0%, rgba(255,255,255,0.98) 42%)',
                                        ...drawerScrollbarSx,
                                    },
                                }}
                                MenuListProps={{ sx: { p: 0 } }}
                            >
                                <Box sx={{ p: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Avatar
                                            src={drawerBrand.profileImageUrl || undefined}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                fontWeight: 900,
                                                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                                                boxShadow: '0 12px 26px rgba(79, 70, 229, 0.28)',
                                            }}
                                        >
                                            {drawerBrand.initial}
                                        </Avatar>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap title={drawerBrand.name}>
                                                {drawerBrand.name}
                                            </Typography>
                                            {drawerBrand.email ? (
                                                <Typography variant="caption" color="text.secondary" noWrap title={drawerBrand.email} sx={{ display: 'block' }}>
                                                    {drawerBrand.email}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </Stack>
                                </Box>
                                <Divider />
                                <Box sx={{ p: 0.75 }}>
                                    {[
                                        { label: t('nav.dashboard'), href: `${adminAppUrl}/dashboard`, icon: <DashboardIcon fontSize="small" /> },
                                        { label: t('nav.profile'), href: `${adminAppUrl}/profile`, icon: <PersonIcon fontSize="small" /> },
                                        ...(permissionCodes.includes('public_page.manage')
                                            ? [{ label: t('nav.settings'), href: `${adminAppUrl}/system/organization-settings`, icon: <SettingsIcon fontSize="small" /> }]
                                            : []),
                                        ...(can('activity_logs.view')
                                            ? [{ label: t('nav.activity_logs'), href: `${adminAppUrl}/system/activity-logs`, icon: <AdminPanelSettingsIcon fontSize="small" /> }]
                                            : []),
                                        ...(can('users.manage')
                                            ? [{ label: t('nav.users'), href: `${adminAppUrl}/iam/users`, icon: <AdminPanelSettingsIcon fontSize="small" /> }]
                                            : []),
                                        ...(can('roles.manage')
                                            ? [{ label: t('nav.roles'), href: `${adminAppUrl}/iam/roles`, icon: <AdminPanelSettingsIcon fontSize="small" /> }]
                                            : []),
                                    ].map((item) => (
                                        <MenuItem
                                            key={item.label}
                                            component={Link}
                                            href={item.href}
                                            onClick={() => setProfileAnchor(null)}
                                            sx={{ borderRadius: 2.5, px: 1.25, py: 1.1, gap: 1.25 }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 2,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    bgcolor: 'action.hover',
                                                    color: 'primary.main',
                                                }}
                                            >
                                                {item.icon}
                                            </Box>
                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                {item.label}
                                            </Typography>
                                        </MenuItem>
                                    ))}
                                </Box>
                                <Divider />
                                {setLocaleUrl ? (
                                    <>
                                        <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                                                <TranslateIcon sx={{ fontSize: 16 }} />
                                                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                                    {supportedLocales[locale] ?? locale.toUpperCase()}
                                                </Typography>
                                            </Stack>
                                        </Box>
                                        <Box sx={{ px: 0.75, pb: 0.75 }}>
                                            {Object.entries(supportedLocales).map(([code, label]) => {
                                                const active = code === locale;
                                                return (
                                                    <MenuItem
                                                        key={code}
                                                        onClick={() => {
                                                            setProfileAnchor(null);
                                                            if (code === locale) return;
                                                            router.post(setLocaleUrl, { locale: code }, { preserveScroll: true, preserveState: true });
                                                        }}
                                                        sx={{
                                                            borderRadius: 2.5,
                                                            px: 1.25,
                                                            py: 1.1,
                                                            gap: 1.25,
                                                            color: active ? 'primary.main' : 'text.primary',
                                                            bgcolor: active ? 'action.selected' : 'transparent',
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 34,
                                                                height: 34,
                                                                borderRadius: 2,
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                                bgcolor: active ? 'rgba(79,70,229,0.12)' : 'action.hover',
                                                                color: active ? 'primary.main' : 'text.secondary',
                                                            }}
                                                        >
                                                            {active ? <CheckIcon fontSize="small" /> : <TranslateIcon fontSize="small" />}
                                                        </Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 800, flex: 1 }}>
                                                            {label}
                                                        </Typography>
                                                        {active ? (
                                                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                                                {code.toUpperCase()}
                                                            </Typography>
                                                        ) : null}
                                                    </MenuItem>
                                                );
                                            })}
                                        </Box>
                                        <Divider />
                                    </>
                                ) : null}
                                <Box sx={{ p: 0.75 }}>
                                    <MenuItem
                                        onClick={() => {
                                            setProfileAnchor(null);
                                            router.post(`${adminAppUrl}/logout`);
                                        }}
                                        sx={{ borderRadius: 2.5, px: 1.25, py: 1.1, gap: 1.25, color: 'error.main' }}
                                    >
                                        <Box
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 2,
                                                display: 'grid',
                                                placeItems: 'center',
                                                bgcolor: dark ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.10)',
                                            }}
                                        >
                                            <LogoutIcon fontSize="small" />
                                        </Box>
                                        <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                            {t('ui.logout')}
                                        </Typography>
                                    </MenuItem>
                                </Box>
                            </Menu>
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
                            ...drawerPaperBaseSx,
                        },
                    }}
                >
                    <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
                        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                            <Avatar
                                src={drawerBrand.profileImageUrl || undefined}
                                sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 900 }}
                            >
                                {drawerBrand.initial}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap title={drawerBrand.name}>
                                    {drawerBrand.name}
                                </Typography>
                                {drawerBrand.email ? (
                                    <Typography variant="caption" color="text.secondary" noWrap title={drawerBrand.email}>
                                        {drawerBrand.email}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Stack>
                    </Box>
                    <Divider sx={{ mx: 1.5, mb: 0.75 }} />
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
                            overflowX: 'hidden',
                            transition: 'width 0.2s ease',
                            ...drawerPaperBaseSx,
                        },
                    }}
                >
                    <Box sx={{ px: desktopOpen ? 1.5 : 0.75, pt: 1.25, pb: 1 }}>
                        <Stack
                            direction="row"
                            spacing={desktopOpen ? 1.25 : 0}
                            sx={{ alignItems: 'center', justifyContent: desktopOpen ? 'flex-start' : 'center' }}
                        >
                            <Avatar
                                src={drawerBrand.profileImageUrl || undefined}
                                sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 900 }}
                            >
                                {drawerBrand.initial}
                            </Avatar>
                            {desktopOpen ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap title={drawerBrand.name}>
                                        {drawerBrand.name}
                                    </Typography>
                                    {drawerBrand.email ? (
                                        <Typography variant="caption" color="text.secondary" noWrap title={drawerBrand.email}>
                                            {drawerBrand.email}
                                        </Typography>
                                    ) : null}
                                </Box>
                            ) : null}
                        </Stack>
                    </Box>
                    <Divider sx={{ mx: desktopOpen ? 1.5 : 0.75, mb: 0.75 }} />
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
                                            {desktopOpen ? (
                                                <ListItemButton component={Link} href={item.href} selected={isActive(item.href)} sx={navItemButtonSx}>
                                                    <ListItemIcon sx={{ minWidth: 0, mr: 1.25, justifyContent: 'center' }}>
                                                        {navIcon(item, isActive(item.href))}
                                                    </ListItemIcon>
                                                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 12.5 }} />
                                                </ListItemButton>
                                            ) : (
                                                <Tooltip title={item.label} placement="right" arrow>
                                                    <ListItemButton component={Link} href={item.href} selected={isActive(item.href)} sx={navItemButtonSx}>
                                                        <ListItemIcon sx={{ minWidth: 0, mr: 0, justifyContent: 'center' }}>
                                                            {navIcon(item, isActive(item.href))}
                                                        </ListItemIcon>
                                                    </ListItemButton>
                                                </Tooltip>
                                            )}
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
                    sx={{
                        flexGrow: 1,
                        pt: { xs: 8, sm: 9 },
                        px: { xs: 1.5, sm: 2.5, lg: 3 },
                        pb: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 3 },
                        bgcolor: 'background.default',
                        maxWidth: '100%',
                    }}
                >
                    {children}
                </Box>

                <MobileBottomNav adminAppUrl={adminAppUrl} />
            </Box>
        </ThemeProvider>
    );
}
