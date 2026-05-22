import { createTheme } from '@mui/material/styles';

export const dashboardTokens = {
    light: {
        bg: '#F5F7FB',
        card: '#FFFFFF',
        border: 'rgba(148, 163, 184, 0.28)',
        glass: 'rgba(255, 255, 255, 0.72)',
        gradientPrimary: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 55%, #6366F1 100%)',
        gradientSecondary: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
        shadow: '0 8px 32px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)',
        shadowHover: '0 16px 48px rgba(79, 70, 229, 0.12), 0 4px 16px rgba(15, 23, 42, 0.06)',
    },
    dark: {
        bg: '#0F172A',
        card: '#1E293B',
        border: 'rgba(148, 163, 184, 0.16)',
        glass: 'rgba(30, 41, 59, 0.75)',
        gradientPrimary: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 50%, #818CF8 100%)',
        gradientSecondary: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
        shadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        shadowHover: '0 16px 48px rgba(99, 102, 241, 0.2)',
    },
};

export function createAdminDashboardTheme(dark = false) {
    const tokens = dark ? dashboardTokens.dark : dashboardTokens.light;

    return createTheme({
        palette: {
            mode: dark ? 'dark' : 'light',
            primary: { main: '#4F46E5', light: '#818CF8', dark: '#3730A3' },
            secondary: { main: '#7C3AED' },
            success: { main: '#10B981' },
            warning: { main: '#F97316' },
            error: { main: '#EF4444' },
            background: {
                default: tokens.bg,
                paper: tokens.card,
            },
            text: {
                primary: dark ? '#F8FAFC' : '#0F172A',
                secondary: dark ? '#94A3B8' : '#64748B',
            },
            divider: tokens.border,
        },
        typography: {
            fontFamily: '"Inter", "Poppins", "Roboto", "Noto Sans Myanmar", sans-serif',
            h4: { fontWeight: 800, letterSpacing: '-0.02em' },
            h5: { fontWeight: 800, letterSpacing: '-0.02em' },
            h6: { fontWeight: 700 },
            subtitle1: { fontWeight: 700 },
            subtitle2: { fontWeight: 700 },
            body2: { lineHeight: 1.55 },
            caption: { fontWeight: 600 },
        },
        shape: { borderRadius: 16 },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: tokens.bg,
                    },
                },
            },
            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        border: `1px solid ${tokens.border}`,
                        backgroundImage: 'none',
                    },
                },
            },
            MuiCard: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        border: `1px solid ${tokens.border}`,
                        boxShadow: tokens.shadow,
                        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                        '&:hover': {
                            boxShadow: tokens.shadowHover,
                        },
                    },
                },
            },
            MuiButton: {
                defaultProps: { disableElevation: true, size: 'small' },
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: 12,
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: { borderRadius: 12 },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: { fontWeight: 600, borderRadius: 10 },
                },
            },
        },
    });
}

export function glassSurface(dark) {
    const t = dark ? dashboardTokens.dark : dashboardTokens.light;
    return {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        backgroundColor: t.glass,
        border: `1px solid ${t.border}`,
        boxShadow: t.shadow,
    };
}
