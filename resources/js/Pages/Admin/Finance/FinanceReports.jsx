import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Box, Button, Divider, Grid, Paper, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useT } from '@/i18n';
import { useCallback, useMemo, useState } from 'react';

function formatMoney(amount, currency) {
    if (amount == null || amount === '' || !Number.isFinite(Number(amount))) {
        return '—';
    }
    const n = Number(amount);
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)} ${currency || 'MMK'}`;
}

function periodLabel(period) {
    if (!period) return '—';
    try {
        const d = new Date(String(period));
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        }
        const [y, m] = String(period).split('-').map((p) => Number(p));
        const dm = new Date(y, (m || 1) - 1, 1);
        return dm.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    } catch {
        return String(period);
    }
}

function CompareBarChart({ series }) {
    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
    const t = useT();

    const maxValue = useMemo(() => {
        return Math.max(
            0,
            ...(series || []).map((r) => Math.max(Number(r?.income || 0), Number(r?.expense || 0))),
        );
    }, [series]);

    const barWidth = isMdUp ? 44 : isSmUp ? 34 : 26;
    const minWidth = Math.max(360, (series?.length || 0) * (barWidth + 10));

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-end', height: 220, minWidth, px: 0.5, pb: 0.5 }}>
                {(series || []).map((r) => {
                    const income = Number(r?.income || 0);
                    const expense = Number(r?.expense || 0);
                    const incomePct = maxValue > 0 ? Math.round((income / maxValue) * 1000) / 10 : 0;
                    const expensePct = maxValue > 0 ? Math.round((expense / maxValue) * 1000) / 10 : 0;

                    return (
                        <Box key={r.period} sx={{ flex: `0 0 ${barWidth}px` }}>
                            <Box sx={{ display: 'flex', gap: 0.5, height: 184, alignItems: 'flex-end' }}>
                                <Box
                                    title={t('finance.reports.chart.income_title', { amount: formatMoney(income, 'MMK') })}
                                    sx={{
                                        width: '50%',
                                        height: `${incomePct}%`,
                                        bgcolor: 'success.main',
                                        borderRadius: 1,
                                        opacity: 0.85,
                                    }}
                                />
                                <Box
                                    title={t('finance.reports.chart.expense_title', { amount: formatMoney(expense, 'MMK') })}
                                    sx={{
                                        width: '50%',
                                        height: `${expensePct}%`,
                                        bgcolor: 'warning.main',
                                        borderRadius: 1,
                                        opacity: 0.9,
                                    }}
                                />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}>
                                {periodLabel(r.period)}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function HorizontalBarList({ title, items, tone = 'warning' }) {
    const t = useT();
    const maxValue = useMemo(() => {
        return Math.max(0, ...(items || []).map((x) => Number(x?.value || 0)));
    }, [items]);

    return (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                {title}
            </Typography>
            <Stack spacing={1.25}>
                {(items || []).map((x) => {
                    const value = Number(x?.value || 0);
                    const pct = maxValue > 0 ? Math.round((value / maxValue) * 1000) / 10 : 0;
                    return (
                        <Box key={`${title}-${x.label}`}>
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {x.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {formatMoney(value, 'MMK')}
                                </Typography>
                            </Stack>
                            <Box sx={{ height: 8, mt: 0.75, borderRadius: 999, bgcolor: 'divider', overflow: 'hidden' }}>
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: `${pct}%`,
                                        bgcolor: tone === 'success' ? 'success.main' : 'warning.main',
                                    }}
                                />
                            </Box>
                        </Box>
                    );
                })}
                {(items || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('finance.reports.no_data')}
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}

export default function FinanceReports() {
    const pageProps = usePage().props;
    const t = useT();
    const adminAppUrl = pageProps.admin_app_url;

    const series = pageProps.series ?? [];
    const totals = pageProps.totals ?? { income: 0, expense: 0, net: 0 };
    const incomeCategories = pageProps.income_categories ?? [];
    const expenseCategories = pageProps.expense_categories ?? [];

    const filters = pageProps.filters ?? {};
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const applyFilters = useCallback(
        (patch) => {
            router.get(
                `${adminAppUrl}/finance/reports`,
                {
                    from,
                    to,
                    ...patch,
                },
                { preserveScroll: true },
            );
        },
        [adminAppUrl, from, to],
    );

    return (
        <AdminLayout title={t('finance.reports.title')}>
            <Head title={t('finance.reports.title')} />

            <Stack spacing={2}>
                <PageHeader
                    title={t('finance.reports.title')}
                    subtitle={t('finance.reports.subtitle')}
                    actions={
                        <Button component={Link} href={`${adminAppUrl}/finance/ledger`} variant="outlined">
                            {t('finance.reports.actions.open_ledger')}
                        </Button>
                    }
                >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="stretch">
                        <TextField
                            size="small"
                            type="date"
                            label={t('filters.from')}
                            InputLabelProps={{ shrink: true }}
                            value={from}
                            onChange={(e) => {
                                setFrom(e.target.value);
                                applyFilters({ from: e.target.value });
                            }}
                            sx={{ width: { xs: '100%', md: 170 } }}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label={t('filters.to')}
                            InputLabelProps={{ shrink: true }}
                            value={to}
                            onChange={(e) => {
                                setTo(e.target.value);
                                applyFilters({ to: e.target.value });
                            }}
                            sx={{ width: { xs: '100%', md: 170 } }}
                        />
                    </Stack>
                </PageHeader>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                {t('finance.totals.total_income')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {formatMoney(totals.income, 'MMK')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                {t('finance.totals.total_expense')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {formatMoney(totals.expense, 'MMK')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                {t('finance.totals.net')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {formatMoney(totals.net, 'MMK')}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {t('finance.reports.sections.income_vs_expense')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('finance.reports.sections.by_month')}
                            </Typography>
                        </Box>
                        <CompareBarChart series={series} />
                        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'success.main' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {t('finance.direction.income')}
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'warning.main' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {t('finance.direction.expense')}
                                </Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <HorizontalBarList title={t('finance.reports.sections.top_expense_categories')} items={expenseCategories} tone="warning" />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <HorizontalBarList title={t('finance.reports.sections.top_income_categories')} items={incomeCategories} tone="success" />
                    </Grid>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}
