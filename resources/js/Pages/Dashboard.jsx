import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Paper, Typography } from '@mui/material';

export default function Dashboard() {
    return (
        <AdminLayout title="Dashboard">
            <Head title="Dashboard" />
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Admin home is now using the new `calamus-v3`-style layout shell.
                </Typography>
            </Paper>
        </AdminLayout>
    );
}
