import { Head, Link, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    AdminPanelSettings as AdminIcon,
    CheckCircle as CheckCircleIcon,
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

export default function Login({ status, canResetPassword }) {
    const { admin_app_url } = usePage().props;
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
            <Head title="Log in" />
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
                                    'linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80")',
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
                                            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)',
                                        }}
                                    >
                                        <AdminIcon sx={{ color: 'white', fontSize: 28 }} />
                                    </Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                        Calamus Education
                                    </Typography>
                                </Stack>

                                <Stack spacing={2}>
                                    <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                        Modern Admin <br />
                                        <Box component="span" sx={{ color: 'primary.main' }}>
                                            Management Console
                                        </Box>
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: 'grey.400', fontWeight: 400, maxWidth: 480 }}>
                                        Access your dashboard to manage courses, students, and system resources.
                                    </Typography>
                                </Stack>

                                <Stack spacing={2.5}>
                                    {[
                                        'Real-time student engagement tracking',
                                        'Advanced course content management',
                                        'Automated reporting and analytics',
                                        'Secure multi-role permission system',
                                    ].map((feature) => (
                                        <Stack key={feature} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                            <Typography variant="body1" sx={{ color: 'grey.300' }}>
                                                {feature}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
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
                        <Box sx={{ maxWidth: 360, width: '100%', mx: 'auto' }}>
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
                                        <AdminIcon sx={{ color: 'white', fontSize: 20 }} />
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        Calamus
                                    </Typography>
                                </Stack>
                            )}

                            <Stack spacing={0.5} sx={{ mb: 3 }}>
                                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                    Sign In
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Please enter your account details below.
                                </Typography>
                            </Stack>

                            {status && <Alert severity="success" sx={{ mb: 2 }}>{status}</Alert>}
                            {errors.email && <Alert severity="error" sx={{ mb: 2 }}>{errors.email}</Alert>}

                            <Box component="form" onSubmit={submit}>
                                <Stack spacing={2}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Email Address"
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
                                        label="Password"
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
                                            label={<Typography variant="caption" sx={{ fontWeight: 500 }}>Remember me</Typography>}
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
                                                Forgot password?
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
                                            py: 1.25,
                                            fontWeight: 700,
                                            borderRadius: 1.5,
                                            textTransform: 'none',
                                            fontSize: '0.875rem',
                                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                                        }}
                                    >
                                        {processing ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
                                    </Button>

                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                        New here?{' '}
                                        <Link href={`${admin_app_url}/register`} style={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                                            Create account
                                        </Link>
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
