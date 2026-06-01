import { useT } from '@/i18n';
import { Head, router, usePage } from '@inertiajs/react';
import { Box, Chip, Container, Divider, FormControl, Grid, MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';

function formatDateTime(value, locale) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString(locale === 'my' ? 'my-MM' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
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

function translatedCode(t, prefix, code, fallback = '—') {
    if (!code) return fallback;

    const key = `${prefix}.${String(code).toLowerCase()}`;
    const translated = t(key);

    return translated === key ? String(code).replace(/_/g, ' ') : translated;
}

export default function VoucherTracking() {
    const { organization, voucher, trip, tracking, i18n } = usePage().props;
    const t = useT();
    const locale = i18n?.locale ?? 'my';
    const supportedLocales = i18n?.supported_locales ?? { my: 'မြန်မာ', en: 'English' };
    const trackingStatus = translatedCode(t, 'voucher_tracking.status', tracking?.code);

    const steps = [
        { label: t('voucher_tracking.status.confirmed'), code: 'CONFIRMED' },
        { label: t('voucher_tracking.status.loading'), code: 'LOADING' },
        { label: t('voucher_tracking.status.in_transit'), code: 'IN_TRANSIT' },
        { label: t('voucher_tracking.status.delivered'), code: 'DELIVERED' },
    ];

    const activeStep = Number.isFinite(Number(tracking?.step)) ? Number(tracking.step) : 0;
    const title = voucher?.voucher_no
        ? t('voucher_tracking.head_title', { voucher_no: voucher.voucher_no })
        : t('voucher_tracking.track_voucher');
    const latestUpdate = trip?.updated_at || voucher?.updated_at || null;
    const summaryCards = [
        {
            label: t('voucher_tracking.tracking_status'),
            value: trackingStatus,
            helper: t('voucher_tracking.last_updated', { time: formatDateTime(latestUpdate, locale) }),
        },
        {
            label: t('voucher_tracking.recipient'),
            value: voucher?.default_recipient_name || '—',
            helper: voucher?.default_recipient_phone || t('voucher_tracking.phone_not_available'),
        },
        {
            label: t('voucher_tracking.destination'),
            value: voucher?.default_to_warehouse?.city || voucher?.default_to_city || '—',
            helper: formatAddress(voucher),
        },
        {
            label: t('voucher_tracking.trip_reference'),
            value: trip?.trip_no || t('voucher_tracking.awaiting_trip_assignment'),
            helper: trip?.status
                ? translatedCode(t, 'voucher_tracking.trip_status', trip.status)
                : t('voucher_tracking.confirmed_and_preparing'),
        },
    ];
    const nextStepMessage =
        tracking?.code === 'DELIVERED'
            ? t('voucher_tracking.message.delivered')
            : tracking?.code === 'IN_TRANSIT'
              ? t('voucher_tracking.message.in_transit')
              : tracking?.code === 'LOADING'
                ? t('voucher_tracking.message.loading')
                : t('voucher_tracking.message.confirmed');

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
                    <Stack direction="row" justifyContent="flex-end">
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                                value={locale}
                                inputProps={{ 'aria-label': t('voucher_tracking.language') }}
                                onChange={(event) =>
                                    router.get(window.location.pathname, { locale: event.target.value }, { preserveScroll: true, replace: true })
                                }
                            >
                                {Object.entries(supportedLocales).map(([code, label]) => (
                                    <MenuItem key={code} value={code}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>

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
                                {t('voucher_tracking.title')}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                                {voucher?.voucher_no || '—'}
                            </Typography>
                            <Typography variant="body2" sx={{ maxWidth: 640, opacity: 0.9 }}>
                                {t('voucher_tracking.subtitle')}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                                <Chip size="small" label={organization?.name || t('voucher_tracking.title')} sx={{ bgcolor: 'rgba(255,255,255,.12)', color: '#fff' }} />
                                <Chip
                                    size="small"
                                    label={trackingStatus}
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
                                    {t('voucher_tracking.delivery_progress')}
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
                                        {t('voucher_tracking.shipment_details')}
                                    </Typography>
                                    <Divider />
                                    <Stack spacing={1.25}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('voucher_tracking.voucher')}
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {voucher?.voucher_no || '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('voucher_tracking.destination')}
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {formatAddress(voucher)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('voucher_tracking.recipient')}
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
                                                {t('voucher_tracking.current_trip')}
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                {trip?.trip_no || t('voucher_tracking.not_assigned_yet')}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                {trip?.status
                                                    ? translatedCode(t, 'voucher_tracking.trip_status', trip.status)
                                                    : t('voucher_tracking.waiting_for_trip_assignment')}
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
                                        {t('voucher_tracking.what_happens_next')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('voucher_tracking.status_updates_description')}
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.default', boxShadow: 'none' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {t('voucher_tracking.latest_update')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {formatDateTime(latestUpdate, locale)}
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.default', boxShadow: 'none' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {t('voucher_tracking.need_help')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                                            {t('voucher_tracking.help_message', { voucher_no: voucher?.voucher_no || '—' })}
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
