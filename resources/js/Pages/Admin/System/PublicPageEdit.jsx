import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Alert, Box, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';

const cardSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: 'none',
};

export default function PublicPageEdit() {
    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const organization = pageProps.organization;
    const publicPage = pageProps.publicPage;
    const flash = pageProps.flash ?? {};

    const form = useForm({
        slug: publicPage?.slug ?? '',
        is_published: Boolean(publicPage?.is_published),
        business_name: publicPage?.business_name ?? '',
        about: publicPage?.about ?? '',
        phone: publicPage?.phone ?? '',
        email: publicPage?.email ?? '',
        address: publicPage?.address ?? '',
        website_url: publicPage?.website_url ?? '',
        facebook_url: publicPage?.facebook_url ?? '',
        logo_url: publicPage?.logo_url ?? '',
        cover_url: publicPage?.cover_url ?? '',
    });

    const submit = (e) => {
        e.preventDefault();
        form.patch(`${adminAppUrl}/system/public-page`, { preserveScroll: true });
    };

    const previewUrl = form.data.slug ? `/p/${form.data.slug}` : null;

    return (
        <AdminLayout title="Public Page">
            <Head title="Public Page" />
            <Stack spacing={2.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <Paper elevation={0} sx={cardSx}>
                    <Stack spacing={0.75}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Public page settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Organization: {organization?.name} ({organization?.code})
                        </Typography>
                        {previewUrl ? (
                            <Typography variant="body2">
                                Preview:{' '}
                                <Link href={previewUrl} style={{ textDecoration: 'underline' }}>
                                    {previewUrl}
                                </Link>
                            </Typography>
                        ) : null}
                    </Stack>
                </Paper>

                <Paper elevation={0} sx={cardSx}>
                    <Box component="form" onSubmit={submit} noValidate>
                        <Stack spacing={2}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.data.is_published}
                                        onChange={(e) => form.setData('is_published', e.target.checked)}
                                    />
                                }
                                label="Published"
                            />

                            <TextField
                                required
                                label="Slug"
                                value={form.data.slug}
                                onChange={(e) => form.setData('slug', e.target.value)}
                                error={Boolean(form.errors.slug)}
                                helperText={form.errors.slug || 'Public URL will be /p/{slug}'}
                            />

                            <TextField
                                label="Business name"
                                value={form.data.business_name}
                                onChange={(e) => form.setData('business_name', e.target.value)}
                                error={Boolean(form.errors.business_name)}
                                helperText={form.errors.business_name}
                            />

                            <TextField
                                label="About"
                                multiline
                                minRows={4}
                                value={form.data.about}
                                onChange={(e) => form.setData('about', e.target.value)}
                                error={Boolean(form.errors.about)}
                                helperText={form.errors.about}
                            />

                            <TextField
                                label="Phone"
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                error={Boolean(form.errors.phone)}
                                helperText={form.errors.phone}
                            />

                            <TextField
                                label="Email"
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                error={Boolean(form.errors.email)}
                                helperText={form.errors.email}
                            />

                            <TextField
                                label="Address"
                                value={form.data.address}
                                onChange={(e) => form.setData('address', e.target.value)}
                                error={Boolean(form.errors.address)}
                                helperText={form.errors.address}
                            />

                            <TextField
                                label="Website URL"
                                value={form.data.website_url}
                                onChange={(e) => form.setData('website_url', e.target.value)}
                                error={Boolean(form.errors.website_url)}
                                helperText={form.errors.website_url}
                            />

                            <TextField
                                label="Facebook URL"
                                value={form.data.facebook_url}
                                onChange={(e) => form.setData('facebook_url', e.target.value)}
                                error={Boolean(form.errors.facebook_url)}
                                helperText={form.errors.facebook_url}
                            />

                            <TextField
                                label="Logo URL"
                                value={form.data.logo_url}
                                onChange={(e) => form.setData('logo_url', e.target.value)}
                                error={Boolean(form.errors.logo_url)}
                                helperText={form.errors.logo_url}
                            />

                            <TextField
                                label="Cover URL"
                                value={form.data.cover_url}
                                onChange={(e) => form.setData('cover_url', e.target.value)}
                                error={Boolean(form.errors.cover_url)}
                                helperText={form.errors.cover_url}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button type="submit" variant="contained" disabled={form.processing}>
                                    Save
                                </Button>
                            </Box>
                        </Stack>
                    </Box>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
