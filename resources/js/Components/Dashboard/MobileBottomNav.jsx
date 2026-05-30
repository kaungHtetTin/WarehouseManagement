import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import InsightsIcon from '@mui/icons-material/Insights';
import SettingsIcon from '@mui/icons-material/Settings';
import { Link, usePage } from '@inertiajs/react';

export default function MobileBottomNav({ adminAppUrl, value = 'dashboard' }) {
    const { url, props } = usePage();
    const currentPath = url.split('?')[0];
    const permissionCodes = props.auth?.permission_codes ?? [];
    const can = (code) => permissionCodes.includes(code);
    const canAny = (...codes) => codes.some((code) => can(code));

    const items = [
        { value: 'dashboard', label: 'Home', href: `${adminAppUrl}/dashboard`, icon: <DashboardIcon /> },
        ...(canAny('vouchers.view', 'vouchers.manage')
            ? [{ value: 'vouchers', label: 'Vouchers', href: `${adminAppUrl}/operations/vouchers`, icon: <ReceiptLongIcon /> }]
            : []),
        ...(canAny('finance.view', 'finance.manage')
            ? [{ value: 'finance', label: 'Finance', href: `${adminAppUrl}/finance/reports`, icon: <InsightsIcon /> }]
            : []),
        ...(can('public_page.manage')
            ? [{ value: 'settings', label: 'Settings', href: `${adminAppUrl}/system/organization-settings`, icon: <SettingsIcon /> }]
            : []),
    ];

    const active =
        items.find((i) => {
            try {
                const path = new URL(i.href).pathname;
                return currentPath === path || currentPath.startsWith(`${path}/`);
            } catch {
                return false;
            }
        })?.value ?? value;

    return (
        <Paper
            elevation={0}
            sx={{
                display: { xs: 'block', md: 'none' },
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: (t) => t.zIndex.appBar,
                borderTop: 1,
                borderColor: 'divider',
                borderRadius: 0,
                pb: 'env(safe-area-inset-bottom)',
                ...{
                    backdropFilter: 'blur(12px)',
                    backgroundColor: (t) => (t.palette.mode === 'dark' ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)'),
                },
            }}
        >
            <BottomNavigation value={active} showLabels sx={{ height: 64 }}>
                {items.map((item) => (
                    <BottomNavigationAction
                        key={item.value}
                        label={item.label}
                        value={item.value}
                        icon={item.icon}
                        component={Link}
                        href={item.href}
                    />
                ))}
            </BottomNavigation>
        </Paper>
    );
}
