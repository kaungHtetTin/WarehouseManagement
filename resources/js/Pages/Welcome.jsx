import { Head, Link } from '@inertiajs/react';
import { Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { ArrowForwardOutlined as ArrowForwardIcon } from '@mui/icons-material';

const modules = [
    ['Voucher Operations', 'Create, print, and track vouchers from one workflow.'],
    ['Trip Coordination', 'Manage dispatch and trip movement with better visibility.'],
    ['Warehouse Flow', 'Coordinate fulfillment and receiving with less friction.'],
];

export default function Welcome(props) {
    const adminUrl = props.admin_app_url;
    const isLoggedIn = Boolean(props.auth?.user);
    const primaryHref = isLoggedIn ? `${adminUrl}/dashboard` : `${adminUrl}/login`;
    const primaryLabel = isLoggedIn ? 'Open Dashboard' : 'Log In';

    return (
        <>
            <Head title="Warehouse Operations Platform" />
            <Box
                sx={{
                    minHeight: '100vh',
                    background:
                        'radial-gradient(circle at top left, rgba(37,99,235,.16), transparent 28%), radial-gradient(circle at bottom right, rgba(245,158,11,.12), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
                }}
            >
                <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
                    <Stack spacing={4}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box component="img" src="/k2_logo_round.png" alt="K2 Software Studio" sx={{ width: 58, height: 58, borderRadius: 1, bgcolor: '#fff', boxShadow: '0 14px 28px rgba(15,23,42,.12)' }} />
                                <Box>
                                    <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '.1em' }}>
                                        K2 Software Studio
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                        Warehouse Management
                                    </Typography>
                                </Box>
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                                <Button component={Link} href={primaryHref} variant="contained" endIcon={<ArrowForwardIcon />}>
                                    {primaryLabel}
                                </Button>
                                {!isLoggedIn && props.canRegister ? (
                                    <Button component={Link} href={`${adminUrl}/register`} variant="outlined">
                                        Create Account
                                    </Button>
                                ) : null}
                            </Stack>
                        </Stack>

                        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 2, color: '#fff', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', boxShadow: '0 28px 70px rgba(15,23,42,.20)' }}>
                            <Stack spacing={3}>
                                <Chip label="Operations Platform" sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 800 }} />
                                <Box>
                                    <Typography variant="h2" sx={{ fontSize: { xs: '2.2rem', sm: '3.2rem', md: '4rem' }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.05em', maxWidth: 760 }}>
                                        Modern warehouse flow for vouchers, trips, and fulfillment.
                                    </Typography>
                                    <Typography variant="h6" sx={{ mt: 2, color: 'rgba(255,255,255,.82)', fontWeight: 400, lineHeight: 1.55, maxWidth: 640 }}>
                                        A cleaner operational workspace for dispatch, warehouse, and finance teams to manage movement, delivery, and payment in one system.
                                    </Typography>
                                </Box>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                                    <Button component={Link} href={primaryHref} variant="contained" color="warning" endIcon={<ArrowForwardIcon />} sx={{ color: '#0f172a', fontWeight: 800 }}>
                                        {primaryLabel}
                                    </Button>
                                    {isLoggedIn ? (
                                        <Button component={Link} href={`${adminUrl}/operations/vouchers`} variant="outlined" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.28)' }}>
                                            View Vouchers
                                        </Button>
                                    ) : null}
                                </Stack>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                                    {['Voucher to delivery workflow', 'Role-based access for teams', 'Admin and public tracking ready'].map((item) => (
                                        <Paper key={item} elevation={0} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', flex: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.6 }}>
                                                {item}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </Stack>
                            </Stack>
                        </Paper>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(148,163,184,.22)', bgcolor: 'rgba(255,255,255,.84)', flex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                    Why this platform
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                                    The system already covers vouchers, trips, warehouse fulfillment, and finance. This redesign improves clarity, trust, and speed for daily work.
                                </Typography>
                            </Paper>
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(148,163,184,.22)', bgcolor: '#fff', flex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                    Start from the right place
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2, lineHeight: 1.7 }}>
                                    Enter the role-based admin panel and continue directly into your operation flow.
                                </Typography>
                                <Stack spacing={1}>
                                    <Button component={Link} href={primaryHref} variant="contained" endIcon={<ArrowForwardIcon />}>
                                        {primaryLabel}
                                    </Button>
                                    {!isLoggedIn && props.canRegister ? (
                                        <Button component={Link} href={`${adminUrl}/register`} variant="outlined">
                                            Register New User
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Paper>
                        </Stack>

                        <Box>
                            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '.08em' }}>
                                Core Modules
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-.04em' }}>
                                Built for real warehouse operations
                            </Typography>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                                {modules.map(([title, description]) => (
                                    <Paper key={title} elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(148,163,184,.18)', bgcolor: 'rgba(255,255,255,.88)', flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                            {title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                                            {description}
                                        </Typography>
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>

                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'rgba(15,23,42,.92)', color: '#fff' }}>
                            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-.03em' }}>
                                        Public entry is now aligned with the product.
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: .75, color: 'rgba(255,255,255,.72)' }}>
                                        Next pages to modernize: authentication, dashboard, and voucher workflows.
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.58)' }}>
                                    Laravel v{props.laravelVersion} - PHP v{props.phpVersion}
                                </Typography>
                            </Stack>
                        </Paper>
                    </Stack>
                </Container>
            </Box>
        </>
    );
}

