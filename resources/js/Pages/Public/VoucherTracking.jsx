import { Head, usePage } from '@inertiajs/react';
import { Box, Chip, Container, Divider, Grid, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return value;
    }
}

function formatAddress(voucher) {
    const parts = [
        voucher?.default_to_warehouse?.city,
        voucher?.default_to_city,
        voucher?.default_to_address_line1,
    ].filter((value, index, arr) => value && arr.indexOf(value) === index);

    return parts.length ? parts.join(' · ') : '—';
}

function trackingTone(code) {
    if (code === 'DELIVERED') return 'success';
    if (code === 'IN_TRANSIT') return 'info';
    if (code === 'LOADING') return 'warning';
    return 'default';
}

export default function VoucherTracking() {
    const { organization, voucher, trip, tracking } = usePage().props;

    const steps = [
        { label: 'Confirmed', code: 'CONFIRMED' },
        { label: 'Loading', code: 'LOADING' },
        { label: 'In transit', code: 'IN_TRANSIT' },
        { label: 'Delivered', code: 'DELIVERED' },
    ];

    const activeStep = Number.isFinite(Number(tracking?.step)) ? Number(tracking.step) : 0;
    const title = voucher?.voucher_no ? `Track ${voucher.voucher_no}` : 'Track voucher';
    const latestUpdate = trip?.updated_at || voucher?.updated_at || null;
    const summaryCards = [
        {
            label: 'Tracking status',
            value: tracking?.label || '—',
            helper: `Last updated ${formatDateTime(latestUpdate)}`,
        },
        {
            label: 'Recipient',
            value: voucher?.default_recipient_name || '—',
            helper: voucher?.default_recipient_phone || 'Phone not available',
        },
        {
            label: 'Destination',
            value: voucher?.default_to_warehouse?.city || voucher?.default_to_city || '—',
            helper: formatAddress(voucher),
        },
        {
            label: 'Trip reference',
            value: trip?.trip_no || 'Awaiting trip assignment',
            helper: trip?.status || 'Confirmed and preparing',
        },
    ];
    const nextStepMessage =
        tracking?.code === 'DELIVERED'
            ? 'This voucher has been delivered successfully.'
            : tracking?.code === 'IN_TRANSIT'
              ? 'Your goods are currently on the way to the destination.'
              : tracking?.code === 'LOADING'
                ? 'Your goods are being prepared and loaded for departure.'
                : 'Your voucher has been confirmed and is waiting for the next operational step.';

    return (
        <Box
            sx={{
                minHeight: '100vh',
                py: { xs: 4, md: 6 },
                background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
            }}
        >
            <Head title={title} />
            <Container maxWidth="md">
                <Stack spacing={2.5}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 2.5, md: 3 },
                            borderRadius: 1.5,
                            color: '#fff',
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                            boxShadow: '0 24px 60px rgba(15,23,42,.16)',
                        }}
                    >
                        <Stack spacing={1.25}>
                            <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>
                                Voucher Tracking
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                                {voucher?.voucher_no || '—'}
                            </Typography>
                            <Typography variant="body2" sx={{ maxWidth: 640, opacity: 0.9 }}>
                                Track the current delivery progress for this voucher and review the latest shipment information.
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                                <Chip size="small" label={organization?.name || 'Voucher Tracking'} sx={{ bgcolor: 'rgba(255,255,255,.12)', color: '#fff' }} />
                                <Chip
                                    size="small"
                                    label={tracking?.label || '—'}
                                    color={trackingTone(tracking?.code)}
                                    variant="outlined"
                                    sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}
                                />
                            </Stack>
                        </Stack>
                    </Paper>

                    <Grid container spacing={1.5}>
                        {summaryCards.map((item) => (
                            <Grid key={item.label} item xs={12} sm={6} md={3}>
                                <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 1.5, boxShadow: 'none', height: '100%' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {item.label}
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 800 }}>
                                        {item.value}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                                        {item.helper}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>

                    <Paper variant="outlined" sx={{ p: { xs: 2.25, md: 2.75 }, borderRadius: 1.5, boxShadow: 'none' }}>
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    Delivery progress
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {nextStepMessage}
                                </Typography>
                            </Box>
                            <Stepper activeStep={Math.min(Math.max(activeStep, 0), steps.length - 1)} alternativeLabel>
                                {steps.map((s) => (
                                    <Step key={s.code}>
                                        <StepLabel>{s.label}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        </Stack>
                    </Paper>

                    <Grid container spacing={1.5}>
                        <Grid item xs={12} md={7}>
                            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1.5, boxShadow: 'none', height: '100%' }}>
                                <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                        Shipment details
                                    </Typography>
                                    <Divider />
                                    <Stack spacing={1.25}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Voucher
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {voucher?.voucher_no || '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Destination
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {formatAddress(voucher)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Recipient
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {voucher?.default_recipient_name || '—'}
                                            </Typography>
                                            {voucher?.default_recipient_phone ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                    {voucher.default_recipient_phone}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Current trip
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {trip?.trip_no || 'Not assigned yet'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                {trip?.status || 'Waiting for trip assignment'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={5}>
                            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1.5, boxShadow: 'none', height: '100%' }}>
                                <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                        What happens next
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Status updates appear here as your voucher moves from confirmation to loading, transport, and delivery.
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.default', boxShadow: 'none' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            Latest update
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {formatDateTime(latestUpdate)}
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.default', boxShadow: 'none' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            Need help?
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                                            Contact the sender or warehouse operator and provide voucher number `{voucher?.voucher_no || '—'}` for faster support.
                                        </Typography>
                                    </Paper>
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </Stack>
            </Container>
        </Box>
    );
}
