import { Head } from '@inertiajs/react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    Container,
    CssBaseline,
    Paper,
    Stack,
    ThemeProvider,
    Typography,
    createTheme,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
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

    const primaryId = useMemo(() => {
        const orgCode = organization?.code ? String(organization.code) : '';
        return orgCode ? orgCode.toUpperCase() : '';
    }, [organization?.code]);

    const coverStyle = useMemo(() => {
        if (!publicPage?.cover_url) return null;
        return {
            backgroundImage: `url(${publicPage.cover_url})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
        };
    }, [publicPage?.cover_url]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Head title={title} />
            <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
                <Box
                    sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                        backdropFilter: 'blur(10px)',
                    }}
                >
                    <Container maxWidth="md">
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 2,
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 900,
                                    flexShrink: 0,
                                }}
                            >
                                {primaryId ? primaryId.slice(0, 2) : 'P'}
                            </Box>
                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap>
                                    {title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                    {organization?.code ? organization.code : ''}
                                </Typography>
                            </Box>
                            {publicPage?.phone ? (
                                <Button
                                    variant="contained"
                                    size="small"
                                    href={`tel:${publicPage.phone}`}
                                    sx={{ borderRadius: 2, textTransform: 'none' }}
                                >
                                    Call
                                </Button>
                            ) : null}
                        </Stack>
                    </Container>
                </Box>

                <Container maxWidth="md" sx={{ py: { xs: 2.5, sm: 4 } }}>
                    <Stack spacing={2.5}>
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <Box
                                sx={{
                                    position: 'relative',
                                    aspectRatio: '16 / 9',
                                    bgcolor: 'grey.100',
                                    ...coverStyle,
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        background:
                                            'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.55) 100%)',
                                    }}
                                />
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        left: { xs: 16, sm: 20 },
                                        right: { xs: 16, sm: 20 },
                                        bottom: { xs: 16, sm: 20 },
                                        color: '#fff',
                                    }}
                                >
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                        {publicPage?.logo_url ? (
                                            <Box
                                                component="img"
                                                src={publicPage.logo_url}
                                                alt="Logo"
                                                sx={{
                                                    width: { xs: 56, sm: 68 },
                                                    height: { xs: 56, sm: 68 },
                                                    borderRadius: 2,
                                                    objectFit: 'cover',
                                                    border: '1px solid rgba(255,255,255,0.35)',
                                                    bgcolor: 'rgba(255,255,255,0.12)',
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: { xs: 56, sm: 68 },
                                                    height: { xs: 56, sm: 68 },
                                                    borderRadius: 2,
                                                    bgcolor: 'rgba(255,255,255,0.14)',
                                                    border: '1px solid rgba(255,255,255,0.25)',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    fontWeight: 900,
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                {primaryId ? primaryId.slice(0, 2) : 'PP'}
                                            </Box>
                                        )}
                                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                            <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.05 }}>
                                                {title}
                                            </Typography>
                                            {publicPage?.about ? (
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        opacity: 0.92,
                                                        mt: 0.75,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 3,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {publicPage.about}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </Stack>
                                </Box>
                            </Box>
                        </Paper>

                        {(publicPage?.kpis || []).length ? (
                            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                                <Stack spacing={1.25}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Highlights
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                        {(publicPage.kpis || []).map((kpi, idx) => (
                                            <Chip
                                                key={idx}
                                                label={`${kpi?.label || ''}: ${kpi?.value || ''}`}
                                                variant="outlined"
                                                sx={{ borderRadius: 2 }}
                                            />
                                        ))}
                                    </Stack>
                                </Stack>
                            </Paper>
                        ) : null}

                        {(publicPage?.services || []).length ? (
                            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                                <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Services
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 1.25,
                                        }}
                                    >
                                        {(publicPage.services || []).map((svc, idx) => (
                                            <Paper key={idx} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                                                <Stack spacing={0.75}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                        {svc?.title || 'Service'}
                                                    </Typography>
                                                    {svc?.description ? (
                                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                            {svc.description}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            </Paper>
                                        ))}
                                    </Box>
                                </Stack>
                            </Paper>
                        ) : null}

                        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                            <Stack spacing={1.25}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                    Mini portfolio
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {publicPage?.about ? 'About and contact details for quick reference.' : 'Contact details for quick reference.'}
                                </Typography>

                                <Stack spacing={1} sx={{ pt: 0.5 }}>
                                    {publicPage?.phone ? (
                                        <Paper
                                            variant="outlined"
                                            sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                    Phone
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" noWrap>
                                                    {publicPage.phone}
                                                </Typography>
                                            </Box>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                href={`tel:${publicPage.phone}`}
                                                sx={{ borderRadius: 2, textTransform: 'none' }}
                                            >
                                                Call
                                            </Button>
                                        </Paper>
                                    ) : null}

                                    {publicPage?.email ? (
                                        <Paper
                                            variant="outlined"
                                            sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                    Email
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" noWrap>
                                                    {publicPage.email}
                                                </Typography>
                                            </Box>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                href={`mailto:${publicPage.email}`}
                                                sx={{ borderRadius: 2, textTransform: 'none' }}
                                            >
                                                Email
                                            </Button>
                                        </Paper>
                                    ) : null}

                                    {publicPage?.address ? (
                                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                Address
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                {publicPage.address}
                                            </Typography>
                                        </Paper>
                                    ) : null}
                                </Stack>
                            </Stack>
                        </Paper>

                        {(publicPage?.gallery || []).length ? (
                            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                                <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Gallery
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                                            gap: 1,
                                        }}
                                    >
                                        {(publicPage.gallery || []).map((item, idx) => (
                                            <Box
                                                key={idx}
                                                component="a"
                                                href={item?.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                sx={{
                                                    display: 'block',
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                    aspectRatio: '4 / 3',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: 'grey.100',
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={item?.url}
                                                    alt={`Gallery ${idx + 1}`}
                                                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                            </Box>
                                        ))}
                                    </Box>
                                </Stack>
                            </Paper>
                        ) : null}

                        {(publicPage?.faqs || []).length ? (
                            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                                <Stack spacing={1.25}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        FAQ
                                    </Typography>
                                    <Box>
                                        {(publicPage.faqs || []).map((faq, idx) => (
                                            <Accordion key={idx} variant="outlined" disableGutters sx={{ mb: 1, borderRadius: 2, overflow: 'hidden' }}>
                                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                        {faq?.q || 'Question'}
                                                    </Typography>
                                                </AccordionSummary>
                                                <AccordionDetails>
                                                    {faq?.a ? (
                                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                            {faq.a}
                                                        </Typography>
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            —
                                                        </Typography>
                                                    )}
                                                </AccordionDetails>
                                            </Accordion>
                                        ))}
                                    </Box>
                                </Stack>
                            </Paper>
                        ) : null}
                    </Stack>
                </Container>
            </Box>
        </ThemeProvider>
    );
}
