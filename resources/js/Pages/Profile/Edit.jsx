import AdminLayout from '@/Layouts/AdminLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';
import { Paper, Stack } from '@mui/material';

export default function Edit({ auth, mustVerifyEmail, status }) {
    return (
        <AdminLayout title="Profile">
            <Head title="Profile" />

            <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <UpdatePasswordForm className="max-w-xl" />
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <DeleteUserForm className="max-w-xl" />
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
