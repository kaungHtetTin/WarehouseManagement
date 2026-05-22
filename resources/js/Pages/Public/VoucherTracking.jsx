import { Head, usePage } from '@inertiajs/react';
import { Box, Container, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';

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

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 4 }}>
            <Head title={title} />
            <Container maxWidth="sm">
                <Stack spacing={2}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                            {organization?.name || 'Voucher Tracking'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {voucher?.voucher_no || '—'}
                        </Typography>
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                            Status: {tracking?.label || '—'}
                        </Typography>
                        <Stepper activeStep={Math.min(Math.max(activeStep, 0), steps.length - 1)} alternativeLabel>
                            {steps.map((s) => (
                                <Step key={s.code}>
                                    <StepLabel>{s.label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
                        <Stack spacing={0.75}>
                            <Typography variant="body2" color="text.secondary">
                                Voucher
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {voucher?.voucher_no || '—'}
                            </Typography>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Destination
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {voucher?.default_to_warehouse?.city || voucher?.default_to_city || '—'}
                            </Typography>

                            {trip?.trip_no ? (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Trip
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {trip.trip_no} ({trip.status})
                                    </Typography>
                                </>
                            ) : null}
                        </Stack>
                    </Paper>
                </Stack>
            </Container>
        </Box>
    );
}

