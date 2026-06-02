import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Email as EmailIcon,
    LanguageOutlined as LanguageIcon,
    Lock as LockIcon,
    LocalShipping as LocalShippingIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Warehouse as WarehouseIcon,
} from '@mui/icons-material';
import { useT } from '@/i18n';

export default function Login({ status, canResetPassword }) {
    const { admin_app_url, i18n } = usePage().props;
    const t = useT();
    const locale = i18n?.locale ?? 'en';
    const supportedLocales = i18n?.supported_locales ?? { en: 'English' };
    const setLocaleUrl = i18n?.set_locale_url;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [showPassword, setShowPassword] = React.useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    useEffect(() => {
        return () => {
            reset('password');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/login`);
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.paper' }}>
            <Head title={t('auth.log_in')} />
            <Box
                sx={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(0, 1.4fr) minmax(360px, 1fr)',
                    },
                }}
            >
                {!isMobile && (
                    <Box>
                        <Box
                            sx={{
                                height: '100%',
                                background:
                                    'linear-gradient(rgba(15, 23, 42, 0.84), rgba(15, 23, 42, 0.84)), url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80")',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                px: { md: 8, lg: 12 },
                                color: 'white',
                            }}
                        >
                            <Stack spacing={3} sx={{ maxWidth: 640 }}>
                                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                    <Box
                                        sx={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 1.5,
                                            bgcolor: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 6px 14px rgba(59, 130, 246, 0.28)',
                                        }}
                                    >
                                        <WarehouseIcon sx={{ color: 'white', fontSize: 24 }} />
                                    </Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                        {t('app.name')}
                                    </Typography>
                                </Stack>

                                <Stack spacing={2}>
                                    <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.05 }}>
                                        {t('login.hero_title_line1')} <br />
                                        <Box component="span" sx={{ color: 'primary.main' }}>
                                            {t('login.hero_title_line2')}
                                        </Box>
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: 'grey.400', fontWeight: 400, maxWidth: 480 }}>
                                        {t('login.hero_subtitle')}
                                    </Typography>
                                </Stack>

                                <Stack spacing={1.75}>
                                    {['login.feature_1', 'login.feature_2', 'login.feature_3'].map((featureKey) => (
                                        <Stack key={featureKey} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                            <Typography variant="body1" sx={{ color: 'grey.300' }}>
                                                {t(featureKey)}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'grey.400' }}>
                                    {t('login.footer_credit')}
                                </Typography>
                            </Stack>
                        </Box>
                    </Box>
                )}

                <Box>
                    <Box
                        sx={{
                            height: '100%',
                            minHeight: '100vh',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative',
                            px: { xs: 2, sm: 8, md: 6, lg: 8, xl: 10 },
                            py: { xs: 2.5, md: 2 },
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            background: {
                                xs: 'radial-gradient(circle at 10% 8%, rgba(79,70,229,0.16), transparent 28%), radial-gradient(circle at 94% 90%, rgba(14,165,233,0.14), transparent 30%), linear-gradient(180deg, #f7f9ff 0%, #eef4ff 100%)',
                                md: 'none',
                            },
                        }}
                    >
                        {isMobile ? (
                            <>
                                <Box
                                    aria-hidden
                                    sx={{
                                        position: 'absolute',
                                        top: -44,
                                        right: -34,
                                        width: 136,
                                        height: 136,
                                        borderRadius: '50%',
                                        border: '22px solid rgba(79,70,229,0.08)',
                                    }}
                                />
                                <Box
                                    aria-hidden
                                    sx={{
                                        position: 'absolute',
                                        bottom: 36,
                                        left: -42,
                                        width: 110,
                                        height: 110,
                                        borderRadius: 4,
                                        bgcolor: 'rgba(14,165,233,0.08)',
                                        transform: 'rotate(24deg)',
                                    }}
                                />
                            </>
                        ) : null}

                        <Stack spacing={1.5} sx={{ position: 'relative', zIndex: 1, maxWidth: { xs: 420, md: 340 }, width: '100%', mx: 'auto' }}>
                            {isMobile && (
                                <Box
                                    sx={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        p: 2,
                                        borderRadius: 3,
                                        color: '#fff',
                                        background: 'linear-gradient(135deg, #312E81 0%, #4F46E5 52%, #0284C7 100%)',
                                        boxShadow: '0 16px 34px rgba(49,46,129,0.24)',
                                    }}
                                >
                                    <Box
                                        aria-hidden
                                        sx={{
                                            position: 'absolute',
                                            top: -22,
                                            right: -12,
                                            opacity: 0.12,
                                        }}
                                    >
                                        <WarehouseIcon sx={{ fontSize: 118 }} />
                                    </Box>

                                    <Stack spacing={1.5} sx={{ position: 'relative' }}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Box
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 1.5,
                                                    bgcolor: 'rgba(255,255,255,0.18)',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                <LocalShippingIcon sx={{ color: '#fff', fontSize: 20 }} />
                                            </Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                                {t('app.short_name')}
                                            </Typography>
                                        </Stack>

                                        <Box>
                                            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900, lineHeight: 1.2 }}>
                                                {t('login.hero_title_line1')} {t('login.hero_title_line2')}
                                            </Typography>
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5 }}>
                                                {t('login.hero_subtitle')}
                                            </Typography>
                                        </Box>

                                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                            {[t('nav.vouchers'), t('nav.trips')].map((label) => (
                                                <Stack
                                                    key={label}
                                                    direction="row"
                                                    spacing={0.5}
                                                    sx={{
                                                        alignItems: 'center',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 10,
                                                        bgcolor: 'rgba(255,255,255,0.14)',
                                                    }}
                                                >
                                                    <CheckCircleIcon sx={{ fontSize: 14, color: '#BFDBFE' }} />
                                                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>
                                                        {label}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Stack>
                                </Box>
                            )}

                            <Box
                                sx={{
                                    p: { xs: 2.25, md: 0 },
                                    borderRadius: { xs: 3, md: 0 },
                                    border: { xs: '1px solid rgba(148,163,184,0.22)', md: 'none' },
                                    bgcolor: { xs: 'rgba(255,255,255,0.92)', md: 'transparent' },
                                    boxShadow: { xs: '0 18px 40px rgba(15,23,42,0.08)', md: 'none' },
                                    backdropFilter: { xs: 'blur(14px)', md: 'none' },
                                }}
                            >
                                <Stack spacing={0.5} sx={{ mb: 3 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                        {t('auth.sign_in')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('login.prompt')}
                                    </Typography>
                                </Stack>

                                {status && <Alert severity="success" sx={{ mb: 2 }}>{status}</Alert>}
                                {errors.email && <Alert severity="error" sx={{ mb: 2 }}>{errors.email}</Alert>}

                                <Box component="form" onSubmit={submit}>
                                    <Stack spacing={1.75}>
                                        <Stack
                                            direction="row"
                                            spacing={1.25}
                                            sx={{
                                                alignItems: 'center',
                                                px: 1.25,
                                                py: 1,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 2,
                                                bgcolor: 'rgba(79,70,229,0.04)',
                                                transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
                                                '&:focus-within': {
                                                    borderColor: 'primary.main',
                                                    bgcolor: 'rgba(79,70,229,0.07)',
                                                    boxShadow: '0 0 0 3px rgba(79,70,229,0.12)',
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    display: 'grid',
                                                    flexShrink: 0,
                                                    placeItems: 'center',
                                                    borderRadius: 1.5,
                                                    bgcolor: 'rgba(79,70,229,0.12)',
                                                    color: 'primary.main',
                                                }}
                                            >
                                                <LanguageIcon sx={{ fontSize: 20 }} />
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                                                >
                                                    {t('voucher_tracking.language')}
                                                </Typography>
                                                <FormControl fullWidth size="small" variant="standard">
                                                    <Select
                                                        disableUnderline
                                                        value={locale}
                                                        inputProps={{ 'aria-label': t('voucher_tracking.language') }}
                                                        renderValue={(code) => supportedLocales[code] ?? String(code).toUpperCase()}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            if (!setLocaleUrl || next === locale) return;
                                                            router.post(setLocaleUrl, { locale: next }, { preserveScroll: true, preserveState: true });
                                                        }}
                                                        sx={{
                                                            mt: -0.2,
                                                            fontSize: '0.8125rem',
                                                            fontWeight: 800,
                                                            '& .MuiSelect-select': { py: '2px !important', pr: '28px !important' },
                                                            '& .MuiSelect-icon': { color: 'primary.main' },
                                                        }}
                                                    >
                                                        {Object.entries(supportedLocales).map(([code, label]) => {
                                                            const active = code === locale;

                                                            return (
                                                                <MenuItem key={code} value={code}>
                                                                    <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
                                                                        <Box
                                                                            sx={{
                                                                                minWidth: 30,
                                                                                px: 0.6,
                                                                                py: 0.25,
                                                                                borderRadius: 1,
                                                                                bgcolor: active ? 'primary.main' : 'action.hover',
                                                                                color: active ? 'primary.contrastText' : 'text.secondary',
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 900,
                                                                                letterSpacing: '0.06em',
                                                                                textAlign: 'center',
                                                                            }}
                                                                        >
                                                                            {code.toUpperCase()}
                                                                        </Box>
                                                                        <Typography variant="body2" sx={{ fontWeight: active ? 800 : 600 }}>
                                                                            {label}
                                                                        </Typography>
                                                                    </Stack>
                                                                </MenuItem>
                                                            );
                                                        })}
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                        </Stack>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={t('auth.email_address')}
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            error={!!errors.email}
                                            required
                                            autoFocus
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={t('auth.password')}
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            error={!!errors.password}
                                            required
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                                                            {showPassword ? (
                                                                <VisibilityOffIcon fontSize="small" />
                                                            ) : (
                                                                <VisibilityIcon fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={data.remember}
                                                        onChange={(e) => setData('remember', e.target.checked)}
                                                    />
                                                }
                                                label={<Typography variant="caption" sx={{ fontWeight: 500 }}>{t('auth.remember_me')}</Typography>}
                                            />
                                            {canResetPassword && (
                                                <Typography
                                                    variant="caption"
                                                    component={Link}
                                                    href={`${admin_app_url}/forgot-password`}
                                                    sx={{
                                                        color: 'primary.main',
                                                        textDecoration: 'none',
                                                        fontWeight: 600,
                                                        '&:hover': { textDecoration: 'underline' },
                                                    }}
                                                >
                                                    {t('auth.forgot_password')}
                                                </Typography>
                                            )}
                                        </Stack>

                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="medium"
                                            type="submit"
                                            disabled={processing}
                                            sx={{
                                                fontWeight: 700,
                                                borderRadius: 1.5,
                                            }}
                                        >
                                            {processing ? <CircularProgress size={18} color="inherit" /> : t('auth.sign_in')}
                                        </Button>

                                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                            {t('login.new_here')}{' '}
                                            <Link href={`${admin_app_url}/register`} style={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                                                {t('auth.create_account')}
                                            </Link>
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                            {t('login.footer_credit')}
                                        </Typography>
                                    </Stack>
                                </Box>
                            </Box>
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
