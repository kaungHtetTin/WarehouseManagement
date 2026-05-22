import AdminLayout from '@/Layouts/AdminLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';
import { Paper, Stack, Typography } from '@mui/material';
import { useT } from '@/i18n';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const t = useT();

    return (
        <AdminLayout title={t('nav.profile')}>
            <Head title={t('nav.profile')} />

            <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {t('profile.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('profile.subtitle')}
                        </Typography>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                        className="max-w-none"
                    />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    <UpdatePasswordForm className="max-w-none" />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    <DeleteUserForm className="max-w-none" />
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
