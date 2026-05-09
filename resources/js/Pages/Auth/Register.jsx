import { Head, Link, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
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
    Badge as BadgeIcon,
    Email as EmailIcon,
    Lock as LockIcon,
    Person as PersonIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

export default function Register() {
    const { admin_app_url } = usePage().props;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
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
            <Head title="Register" />
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
                                    'linear-gradient(rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.82)), url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80")',
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
                                        <AdminIcon sx={{ color: 'white', fontSize: 28 }} />
                                    </Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                        Calamus Education
                                    </Typography>
                                </Stack>
                                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                    Create your admin <br />
                                    <Box component="span" sx={{ color: 'primary.main' }}>
                                        workspace account
                                    </Box>
                                </Typography>
                                <Typography variant="h6" sx={{ color: 'grey.400', fontWeight: 400, maxWidth: 500 }}>
                                    Start with a secure account to access dashboard tools and management workflows.
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
                                        <AdminIcon sx={{ color: 'white', fontSize: 20 }} />
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        Calamus
                                    </Typography>
                                </Stack>
                            )}

                            <Stack spacing={0.5} sx={{ mb: 3 }}>
                                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                                    Register
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Create your account details to continue.
                                </Typography>
                            </Stack>

                            {(errors.name || errors.email || errors.password) && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {errors.name || errors.email || errors.password}
                                </Alert>
                            )}

                            <Box component="form" onSubmit={submit}>
                                <Stack spacing={2}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Full Name"
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
                                        label="Email Address"
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

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Confirm Password"
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
                                        {processing ? <CircularProgress size={20} color="inherit" /> : 'Create Account'}
                                    </Button>

                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                        Already registered?{' '}
                                        <Link href={`${admin_app_url}/login`} style={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                                            Sign in
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
