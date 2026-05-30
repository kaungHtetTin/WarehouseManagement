import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
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
    Badge as BadgeIcon,
    Business as BusinessIcon,
    Email as EmailIcon,
    Lock as LockIcon,
    LocalShipping as LocalShippingIcon,
    Person as PersonIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Warehouse as WarehouseIcon,
} from '@mui/icons-material';
import { useT } from '@/i18n';

export default function Register() {
    const { admin_app_url, i18n } = usePage().props;
    const t = useT();
    const locale = i18n?.locale ?? 'en';
    const supportedLocales = i18n?.supported_locales ?? { en: 'English' };
    const setLocaleUrl = i18n?.set_locale_url;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        organization_name: '',
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        return () => {
            reset('password', 'password_confirmation');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/register`);
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.paper' }}>
            <Head title={t('auth.register_title')} />
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
                                px: { md: 8, lg: 12 },
                                color: 'white',
                            }}
                        >
                            <Stack spacing={4}>
                                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 1.5,
                                            bgcolor: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <WarehouseIcon sx={{ color: 'white', fontSize: 28 }} />
                                    </Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                        {t('app.name')}
                                    </Typography>
                                </Stack>
                                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                    {t('register.hero_title_line1')} <br />
                                    <Box component="span" sx={{ color: 'primary.main' }}>
                                        {t('register.hero_title_line2')}
                                    </Box>
                                </Typography>
                                <Typography variant="h6" sx={{ color: 'grey.400', fontWeight: 400, maxWidth: 500 }}>
                                    {t('register.hero_subtitle')}
                                </Typography>
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
                        <Box sx={{ maxWidth: 380, width: '100%', mx: 'auto' }}>
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
                                    {t('auth.register')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('register.prompt')}
                                </Typography>
                            </Stack>

                            <Alert severity="info" sx={{ mb: 2 }}>
                                The user who creates the organization becomes the Super Admin for that organization.
                            </Alert>

                            {(errors.organization_name || errors.name || errors.email || errors.password) && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {errors.organization_name || errors.name || errors.email || errors.password}
                                </Alert>
                            )}

                            <Box component="form" onSubmit={submit}>
                                <Stack spacing={2}>
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
                                        label={t('register.organization_name')}
                                        value={data.organization_name}
                                        onChange={(e) => setData('organization_name', e.target.value)}
                                        error={!!errors.organization_name}
                                        required
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <BusinessIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        helperText="This creates a new organization workspace."
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('register.full_name')}
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        error={!!errors.name}
                                        required
                                        autoFocus
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('auth.email_address')}
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        error={!!errors.email}
                                        required
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

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('auth.confirm_password')}
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        error={!!errors.password_confirmation}
                                        required
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        edge="end"
                                                    >
                                                        {showConfirmPassword ? (
                                                            <VisibilityOffIcon fontSize="small" />
                                                        ) : (
                                                            <VisibilityIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="medium"
                                        type="submit"
                                        disabled={processing}
                                        sx={{
                                            py: 1.25,
                                            fontWeight: 700,
                                            borderRadius: 1.5,
                                            textTransform: 'none',
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        {processing ? <CircularProgress size={20} color="inherit" /> : t('auth.create_account')}
                                    </Button>

                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                        This account will be created as the Super Admin for the new organization.
                                    </Typography>

                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                        {t('register.already_registered')}{' '}
                                        <Link href={`${admin_app_url}/login`} style={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                                            {t('auth.sign_in')}
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
