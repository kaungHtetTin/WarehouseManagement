import AdminLayout from '@/Layouts/AdminLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import PageHeader from '@/Components/PageHeader';
import { Head } from '@inertiajs/react';
import { Paper, Stack } from '@mui/material';
import { useT } from '@/i18n';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const t = useT();

    return (
        <AdminLayout title={t('nav.profile')}>
            <Head title={t('nav.profile')} />

            <Stack spacing={1.5}>
                <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

                <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2 }, borderRadius: 2 }}>
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                        className="max-w-none"
                    />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2 }, borderRadius: 2 }}>
                    <UpdatePasswordForm className="max-w-none" />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2 }, borderRadius: 2 }}>
                    <DeleteUserForm className="max-w-none" />
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
