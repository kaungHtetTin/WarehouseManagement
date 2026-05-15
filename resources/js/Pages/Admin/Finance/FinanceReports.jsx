import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Box, Button, Divider, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

function formatMoney(amount, currency) {
    if (amount == null || amount === '' || !Number.isFinite(Number(amount))) {
        return '—';
    }
    const n = Number(amount);
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency || 'MMK'}`;
}

function periodLabel(period, groupBy) {
    if (!period) return '—';
    try {
        if (groupBy === 'month') {
            const [y, m] = String(period).split('-').map((p) => Number(p));
            const d = new Date(y, (m || 1) - 1, 1);
            return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        }
        const d = new Date(String(period));
        return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
    } catch {
        return String(period);
    }
}

function CompareBarChart({ series, groupBy }) {
    const maxValue = useMemo(() => {
        return Math.max(
            0,
            ...(series || []).map((r) => Math.max(Number(r?.income || 0), Number(r?.expense || 0))),
        );
    }, [series]);

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-end', height: 220, minWidth: 520, px: 0.5, pb: 0.5 }}>
                {(series || []).map((r) => {
                    const income = Number(r?.income || 0);
                    const expense = Number(r?.expense || 0);
                    const incomePct = maxValue > 0 ? Math.round((income / maxValue) * 1000) / 10 : 0;
                    const expensePct = maxValue > 0 ? Math.round((expense / maxValue) * 1000) / 10 : 0;

                    return (
                        <Box key={r.period} sx={{ flex: '0 0 44px' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, height: 184, alignItems: 'flex-end' }}>
                                <Box
                                    title={`Income: ${formatMoney(income, 'MMK')}`}
                                    sx={{
                                        width: '50%',
                                        height: `${incomePct}%`,
                                        bgcolor: 'success.main',
                                        borderRadius: 1,
                                        opacity: 0.85,
                                    }}
                                />
                                <Box
                                    title={`Expense: ${formatMoney(expense, 'MMK')}`}
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
                                {periodLabel(r.period, groupBy)}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function HorizontalBarList({ title, items, tone = 'warning' }) {
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
                        No data.
                    </Typography>
                ) : null}
            </Stack>
        </Paper>
    );
}

export default function FinanceReports() {
    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;

    const series = pageProps.series ?? [];
    const totals = pageProps.totals ?? { income: 0, expense: 0, net: 0 };
    const warehouses = pageProps.warehouses ?? [];
    const incomeCategories = pageProps.income_categories ?? [];
    const expenseCategories = pageProps.expense_categories ?? [];

    const filters = pageProps.filters ?? {};
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [groupBy, setGroupBy] = useState(filters.group_by ?? 'month');
    const [scope, setScope] = useState(filters.scope ?? 'all');
    const [warehouseId, setWarehouseId] = useState(filters.warehouse_id ?? 'all');

    const applyFilters = useCallback(
        (patch) => {
            router.get(
                `${adminAppUrl}/finance/reports`,
                {
                    from,
                    to,
                    group_by: groupBy,
                    scope,
                    warehouse_id: warehouseId,
                    ...patch,
                },
                { preserveScroll: true },
            );
        },
        [adminAppUrl, from, to, groupBy, scope, warehouseId],
    );

    return (
        <AdminLayout title="Finance Reports">
            <Head title="Finance Reports" />

            <Stack spacing={2.5}>
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                    Finance Reports
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Reporting and analysis based on finance ledger entries.
                                </Typography>
                            </Box>
                            <Button component={Link} href={`${adminAppUrl}/finance/ledger`} variant="outlined">
                                Open ledger
                            </Button>
                        </Stack>

                        <Divider />

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="stretch">
                            <TextField
                                size="small"
                                type="date"
                                label="From"
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
                                label="To"
                                InputLabelProps={{ shrink: true }}
                                value={to}
                                onChange={(e) => {
                                    setTo(e.target.value);
                                    applyFilters({ to: e.target.value });
                                }}
                                sx={{ width: { xs: '100%', md: 170 } }}
                            />
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 160 } }}>
                                <InputLabel id="fin-groupby">Group by</InputLabel>
                                <Select
                                    labelId="fin-groupby"
                                    label="Group by"
                                    value={groupBy}
                                    onChange={(e) => {
                                        setGroupBy(e.target.value);
                                        applyFilters({ group_by: e.target.value });
                                    }}
                                >
                                    <MenuItem value="month">Month</MenuItem>
                                    <MenuItem value="day">Day</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 180 } }}>
                                <InputLabel id="fin-scope">Scope</InputLabel>
                                <Select
                                    labelId="fin-scope"
                                    label="Scope"
                                    value={scope}
                                    onChange={(e) => {
                                        setScope(e.target.value);
                                        applyFilters({ scope: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="GENERAL">GENERAL</MenuItem>
                                    <MenuItem value="VOUCHER">VOUCHER</MenuItem>
                                    <MenuItem value="TRIP_COST">TRIP_COST</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 260 } }}>
                                <InputLabel id="fin-warehouse">Warehouse</InputLabel>
                                <Select
                                    labelId="fin-warehouse"
                                    label="Warehouse"
                                    value={warehouseId}
                                    onChange={(e) => {
                                        setWarehouseId(e.target.value);
                                        applyFilters({ warehouse_id: e.target.value });
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="none">Unassigned</MenuItem>
                                    {warehouses.map((w) => (
                                        <MenuItem key={w.id} value={String(w.id)}>
                                            {w.code} · {w.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                Total income
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {formatMoney(totals.income, 'MMK')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                Total expense
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {formatMoney(totals.expense, 'MMK')}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                                Net
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
                                Income vs Expense
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Comparison grouped by {groupBy}.
                            </Typography>
                        </Box>
                        <CompareBarChart series={series} groupBy={groupBy} />
                        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'success.main' }} />
                                <Typography variant="caption" color="text.secondary">
                                    Income
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'warning.main' }} />
                                <Typography variant="caption" color="text.secondary">
                                    Expense
                                </Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <HorizontalBarList title="Top expense categories" items={expenseCategories} tone="warning" />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <HorizontalBarList title="Top income categories" items={incomeCategories} tone="success" />
                    </Grid>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}

