import { useEffect, useState } from 'react';
import AuthShell from '@/Components/AuthShell';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Button,
    CircularProgress,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useT } from '@/i18n';

export default function ResetPassword({ token, email }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        return () => {
            reset('password', 'password_confirmation');
        };
    }, []);

    const onHandleChange = (event) => {
        setData(event.target.name, event.target.value);
    };

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/reset-password`);
    };

    return (
        <AuthShell
            title={t('auth.reset_password_title')}
            subtitle="Set a new password to restore access to your account."
            eyebrow="Reset Password"
            sideTitle="Create a new password and get back to work."
            sideDescription="Use a strong password so your organization data and operational activity stay protected."
        >
            <Head title={t('auth.reset_password_title')} />
            <Stack component="form" onSubmit={submit} spacing={2}>
                {errors.email || errors.password || errors.password_confirmation ? (
                    <Alert severity="error">{errors.email || errors.password || errors.password_confirmation}</Alert>
                ) : null}

                <TextField
                    id="email"
                    name="email"
                    type="email"
                    label={t('auth.email')}
                    value={data.email}
                    onChange={onHandleChange}
                    autoComplete="username"
                    error={Boolean(errors.email)}
                    required
                />

                <TextField
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    label={t('auth.password')}
                    value={data.password}
                    onChange={onHandleChange}
                    autoComplete="new-password"
                    error={Boolean(errors.password)}
                    required
                    autoFocus
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton edge="end" onClick={() => setShowPassword((value) => !value)}>
                                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    name="password_confirmation"
                    type={showConfirmPassword ? 'text' : 'password'}
                    label={t('auth.confirm_password')}
                    value={data.password_confirmation}
                    onChange={onHandleChange}
                    autoComplete="new-password"
                    error={Boolean(errors.password_confirmation)}
                    required
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton edge="end" onClick={() => setShowConfirmPassword((value) => !value)}>
                                    {showConfirmPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                <Button type="submit" variant="contained" disabled={processing} sx={{ py: 1.2, fontWeight: 700 }}>
                    {processing ? <CircularProgress size={20} color="inherit" /> : t('auth.reset_password')}
                </Button>
            </Stack>
        </AuthShell>
    );
}
