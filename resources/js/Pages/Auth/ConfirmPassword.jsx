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

export default function ConfirmPassword() {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    useEffect(() => {
        return () => {
            reset('password');
        };
    }, []);

    const handleOnChange = (event) => {
        setData(event.target.name, event.target.value);
    };

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/confirm-password`);
    };

    return (
        <AuthShell
            title={t('auth.confirm_password_title')}
            subtitle={t('confirm_password.description')}
            eyebrow="Secure Confirmation"
            sideTitle="Confirm your identity before continuing."
            sideDescription="Sensitive actions require one more password check to protect your organization and operational records."
        >
            <Head title={t('auth.confirm_password_title')} />
            <Stack component="form" onSubmit={submit} spacing={2}>
                {errors.password ? <Alert severity="error">{errors.password}</Alert> : null}

                <TextField
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    label={t('auth.password')}
                    value={data.password}
                    onChange={handleOnChange}
                    required
                    autoFocus
                    error={Boolean(errors.password)}
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

                <Button type="submit" variant="contained" disabled={processing} sx={{ py: 1.2, fontWeight: 700 }}>
                    {processing ? <CircularProgress size={20} color="inherit" /> : t('auth.confirm')}
                </Button>
            </Stack>
        </AuthShell>
    );
}
