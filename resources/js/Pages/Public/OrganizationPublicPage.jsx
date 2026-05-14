import { Head } from '@inertiajs/react';
import { Box, Container, CssBaseline, Link as MuiLink, Paper, Stack, ThemeProvider, Typography, createTheme } from '@mui/material';
import { useMemo } from 'react';

export default function OrganizationPublicPage({ organization, publicPage }) {
    const title = publicPage?.business_name || organization?.name || 'Public page';
    const themeColor = publicPage?.theme_color || '#3B82F6';

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: 'light',
                    primary: { main: themeColor },
                },
                shape: { borderRadius: 8 },
            }),
        [themeColor],
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Head title={title} />
            <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', py: { xs: 2.5, sm: 4 } }}>
                <Container maxWidth="md">
                    <Stack spacing={2.5}>
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: { xs: 2, sm: 2.5 }, py: 1.75 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {organization?.code ? organization.code : ' '}
                                </Typography>
                            </Box>

                            {publicPage?.cover_url ? (
                                <Box
                                    sx={{
                                        height: { xs: 160, sm: 220 },
                                        backgroundImage: `url(${publicPage.cover_url})`,
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: 'cover',
                                    }}
                                />
                            ) : null}

                            <Box sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: 'background.paper' }}>
                                <Stack spacing={1.25}>
                                    {publicPage?.logo_url ? (
                                        <Box
                                            component="img"
                                            src={publicPage.logo_url}
                                            alt="Logo"
                                            sx={{ width: 72, height: 72, borderRadius: 2, objectFit: 'cover' }}
                                        />
                                    ) : null}
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                        {title}
                                    </Typography>
                                    {publicPage?.about ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {publicPage.about}
                                        </Typography>
                                    ) : null}
                                </Stack>
                            </Box>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                            <Stack spacing={1}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    Contact
                                </Typography>
                                {publicPage?.phone ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Phone: {publicPage.phone}
                                    </Typography>
                                ) : null}
                                {publicPage?.email ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Email: {publicPage.email}
                                    </Typography>
                                ) : null}
                                {publicPage?.address ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                        Address: {publicPage.address}
                                    </Typography>
                                ) : null}
                                {publicPage?.website_url ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Website:{' '}
                                        <MuiLink href={publicPage.website_url} target="_blank" rel="noreferrer">
                                            {publicPage.website_url}
                                        </MuiLink>
                                    </Typography>
                                ) : null}
                                {publicPage?.facebook_url ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Facebook:{' '}
                                        <MuiLink href={publicPage.facebook_url} target="_blank" rel="noreferrer">
                                            {publicPage.facebook_url}
                                        </MuiLink>
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Paper>
                    </Stack>
                </Container>
            </Box>
        </ThemeProvider>
    );
}
