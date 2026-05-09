import { useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AppBar,
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
    AutoAwesomeMosaic as UiShowcaseIcon,
    Dashboard as DashboardIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Person as PersonIcon,
} from '@mui/icons-material';

const drawerWidth = 220;

export default function AdminLayout({ children, title = 'Admin Panel' }) {
    const { url, props } = usePage();
    const adminAppUrl = props.admin_app_url;
    const authUser = props.auth?.user;
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

    const navGroups = [
        {
            title: 'Main',
            items: [{ label: 'Dashboard', href: `${adminAppUrl}/dashboard`, icon: <DashboardIcon /> }],
        },
        {
            title: 'System',
            items: [{ label: 'UI Showcase', href: `${adminAppUrl}/ui-showcase`, icon: <UiShowcaseIcon /> }],
        },
        {
            title: 'Account',
            items: [{ label: 'Profile', href: `${adminAppUrl}/profile`, icon: <PersonIcon /> }],
        },
    ];

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
                        },
                    }}
                >
                    <Toolbar variant="dense" sx={{ minHeight: 48 }} />
                    <Box sx={{ py: 1 }}>
                        {navGroups.map((group, idx) => (
                            <Box key={`mobile-${group.title}`}>
                                <Typography
                                    variant="overline"
                                    sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 700 }}
                                >
                                    {group.title}
                                </Typography>
                                <List dense disablePadding>
                                    {group.items.map((item) => (
                                        <ListItem key={`mobile-${item.label}`} disablePadding sx={{ px: 1, py: 0.25 }}>
                                            <ListItemButton
                                                component={Link}
                                                href={item.href}
                                                selected={isActive(item.href)}
                                                onClick={() => setMobileOpen(false)}
                                                sx={{ borderRadius: 1.25, minHeight: 40, px: 1.25 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 0, mr: 1.5, justifyContent: 'center' }}>
                                                    {item.icon}
                                                </ListItemIcon>
                                                <ListItemText primary={item.label} />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                                {idx < navGroups.length - 1 && <Divider sx={{ mx: 1.5, my: 1 }} />}
                            </Box>
                        ))}
                    </Box>
                </Drawer>

                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        width: desktopOpen ? drawerWidth : 72,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: desktopOpen ? drawerWidth : 72,
                            boxSizing: 'border-box',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            overflowX: 'hidden',
                            transition: 'width 0.2s ease',
                        },
                    }}
                >
                    <Toolbar variant="dense" sx={{ minHeight: 48 }} />
                    <Box sx={{ py: 1 }}>
                        {navGroups.map((group, idx) => (
                            <Box key={group.title}>
                                {desktopOpen && (
                                    <Typography
                                        variant="overline"
                                        sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 700 }}
                                    >
                                        {group.title}
                                    </Typography>
                                )}
                                <List dense disablePadding>
                                    {group.items.map((item) => (
                                        <ListItem key={item.label} disablePadding sx={{ px: 1, py: 0.25 }}>
                                            <ListItemButton
                                                component={Link}
                                                href={item.href}
                                                selected={isActive(item.href)}
                                                sx={{ borderRadius: 1.25, minHeight: 40, px: 1.25 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 0, mr: desktopOpen ? 1.5 : 0, justifyContent: 'center' }}>
                                                    {item.icon}
                                                </ListItemIcon>
                                                {desktopOpen && <ListItemText primary={item.label} />}
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                                {idx < navGroups.length - 1 && <Divider sx={{ mx: 1.5, my: 1 }} />}
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
