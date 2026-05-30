import { Link, router, usePage } from '@inertiajs/react';
import {
    Box,
    FormControl,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography,
} from '@mui/material';

export default function AuthShell({
    title,
    subtitle,
    eyebrow = 'Secure Access',
    sideTitle = 'Warehouse operations made easier to manage.',
    sideDescription = 'Use the admin workspace to handle vouchers, fulfillment, finance, and delivery flow with less friction.',
    children,
}) {
    const { i18n } = usePage().props;
    const locale = i18n?.locale ?? 'en';
    const supportedLocales = i18n?.supported_locales ?? { en: 'English' };
    const setLocaleUrl = i18n?.set_locale_url;

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(380px, 520px)' },
                background:
                    'radial-gradient(circle at top left, rgba(37,99,235,.16), transparent 28%), radial-gradient(circle at bottom right, rgba(245,158,11,.12), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
            }}
        >
            <Box
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    px: { md: 7, lg: 10 },
                    py: 6,
                }}
            >
                <Stack spacing={3.5} sx={{ maxWidth: 620 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            component={Link}
                            href="/"
                            sx={{
                                width: 58,
                                height: 58,
                                borderRadius: 1,
                                overflow: 'hidden',
                                bgcolor: '#fff',
                                boxShadow: '0 16px 32px rgba(15,23,42,.12)',
                            }}
                        >
                            <Box component="img" src="/k2_logo_round.png" alt="K2 Software Studio" sx={{ width: '100%', height: '100%' }} />
                        </Box>
                        <Box>
                            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '.1em' }}>
                                K2 Software Studio
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>
                                Warehouse Management
                            </Typography>
                        </Box>
                    </Stack>
                    <Box>
                        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '.08em' }}>
                            {eyebrow}
                        </Typography>
                        <Typography
                            variant="h2"
                            sx={{
                                mt: 1,
                                fontWeight: 900,
                                lineHeight: 1.02,
                                letterSpacing: '-.05em',
                                maxWidth: 560,
                            }}
                        >
                            {sideTitle}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary', fontWeight: 400, lineHeight: 1.6, maxWidth: 560 }}>
                            {sideDescription}
                        </Typography>
                    </Box>
                    <Stack spacing={1.25}>
                        {[
                            'One place for vouchers and trip updates',
                            'Clearer flow for warehouse and finance teams',
                            'Consistent entry experience across the platform',
                        ].map((item) => (
                            <Paper key={item} elevation={0} sx={{ px: 2, py: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.72)' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {item}
                                </Typography>
                            </Paper>
                        ))}
                    </Stack>
                </Stack>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 2, sm: 4, md: 5 },
                    py: { xs: 3, md: 6 },
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        width: '100%',
                        maxWidth: 400,
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: 2,
                        border: '1px solid rgba(148,163,184,.18)',
                        boxShadow: '0 16px 40px rgba(15,23,42,.07)',
                    }}
                >
                    <Stack spacing={2.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                            <Box>
                                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '.08em' }}>
                                    {eyebrow}
                                </Typography>
                                <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 900, letterSpacing: '-.03em' }}>
                                    {title}
                                </Typography>
                                {subtitle ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.65 }}>
                                        {subtitle}
                                    </Typography>
                                ) : null}
                            </Box>
                            {setLocaleUrl ? (
                                <FormControl size="small" sx={{ minWidth: 110 }}>
                                    <Select
                                        value={locale}
                                        onChange={(e) =>
                                            router.post(setLocaleUrl, { locale: e.target.value }, { preserveScroll: true, preserveState: true })
                                        }
                                    >
                                        {Object.entries(supportedLocales).map(([code, label]) => (
                                            <MenuItem key={code} value={code}>
                                                {label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ) : null}
                        </Stack>
                        {children}
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}
