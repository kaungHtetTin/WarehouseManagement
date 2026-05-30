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
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            px: { xs: 3, sm: 8, md: 6, lg: 8, xl: 10 },
                            py: 2,
                            overflowY: 'auto',
                        }}
                    >
                        <Box sx={{ maxWidth: 340, width: '100%', mx: 'auto' }}>
                            {isMobile && (
                                <Stack direction="row" spacing={1.5} sx={{ mb: 4, alignItems: 'center' }}>
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 1,
                                            bgcolor: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <LocalShippingIcon sx={{ color: 'white', fontSize: 20 }} />
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        {t('app.short_name')}
                                    </Typography>
                                </Stack>
                            )}

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
                                    <FormControl size="small">
                                        <Select
                                            value={locale}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                if (!setLocaleUrl) return;
                                                router.post(setLocaleUrl, { locale: next }, { preserveScroll: true, preserveState: true });
                                            }}
                                        >
                                            {Object.entries(supportedLocales).map(([code, label]) => (
                                                <MenuItem key={code} value={code}>
                                                    {label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
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
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
