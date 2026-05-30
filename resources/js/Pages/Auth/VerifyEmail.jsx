import AuthShell from '@/Components/AuthShell';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useT } from '@/i18n';

export default function VerifyEmail({ status }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/email/verification-notification`);
    };

    return (
        <AuthShell
            title={t('auth.email_verification_title')}
            subtitle={t('verify_email.description')}
            eyebrow="Email Verification"
            sideTitle="Verify the email that protects your workspace."
            sideDescription="A verified email keeps account recovery, access notifications, and organization ownership flow secure."
        >
            <Head title={t('auth.email_verification_title')} />
            <Stack component="form" onSubmit={submit} spacing={2}>
                {status === 'verification-link-sent' ? (
                    <Alert severity="success">{t('verify_email.link_sent')}</Alert>
                ) : null}

                <Button type="submit" variant="contained" disabled={processing} sx={{ py: 1.2, fontWeight: 700 }}>
                    {t('verify_email.resend')}
                </Button>

                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Need to use another account?{' '}
                    <Link href={`${admin_app_url}/logout`} method="post" as="button" style={{ fontWeight: 700 }}>
                        {t('auth.log_out')}
                    </Link>
                </Typography>
            </Stack>
        </AuthShell>
    );
}
