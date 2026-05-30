import AuthShell from '@/Components/AuthShell';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useT } from '@/i18n';

export default function ForgotPassword({ status }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const onHandleChange = (event) => {
        setData(event.target.name, event.target.value);
    };

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/forgot-password`);
    };

    return (
        <AuthShell
            title={t('auth.forgot_password_title')}
            subtitle={t('forgot_password.description')}
            eyebrow="Account Recovery"
            sideTitle="Recover access without losing momentum."
            sideDescription="Send a reset link to the account email and return to the admin workspace securely."
        >
            <Head title={t('auth.forgot_password_title')} />
            <Stack component="form" onSubmit={submit} spacing={2}>
                {status ? <Alert severity="success">{status}</Alert> : null}
                {errors.email ? <Alert severity="error">{errors.email}</Alert> : null}

                <TextField
                    id="email"
                    name="email"
                    type="email"
                    label={t('auth.email_address')}
                    value={data.email}
                    onChange={onHandleChange}
                    required
                    autoFocus
                    error={Boolean(errors.email)}
                />

                <Button type="submit" variant="contained" disabled={processing} sx={{ py: 1.2, fontWeight: 700 }}>
                    {processing ? <CircularProgress size={20} color="inherit" /> : t('forgot_password.email_reset_link')}
                </Button>

                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Remembered your password?{' '}
                    <Link href={`${admin_app_url}/login`} style={{ fontWeight: 700 }}>
                        {t('auth.sign_in')}
                    </Link>
                </Typography>
            </Stack>
        </AuthShell>
    );
}
