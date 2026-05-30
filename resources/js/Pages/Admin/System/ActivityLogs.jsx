import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, router, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return value;
    }
}

export default function ActivityLogs() {
    const theme = useTheme();
    const isCompact = useMediaQuery(theme.breakpoints.down('md'));
    const t = useT();
    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const flash = pageProps.flash ?? {};
    const logs = pageProps.logs ?? { data: [], current_page: 1, last_page: 1, total: 0, per_page: 50 };
    const actions = pageProps.actions ?? [];
    const users = pageProps.users ?? [];
    const filters = pageProps.filters ?? {};

    const [form, setForm] = useState({
        search: filters.search ?? '',
        action: filters.action ?? 'all',
        user_id: filters.user_id ?? 'all',
        from: filters.from ?? '',
        to: filters.to ?? '',
        per_page: String(filters.per_page ?? 50),
    });
    const [selectedLog, setSelectedLog] = useState(null);

    const rows = useMemo(() => (Array.isArray(logs.data) ? logs.data : []), [logs.data]);

    const applyFilters = (page = 1) => {
        router.get(
            `${adminAppUrl}/system/activity-logs`,
            {
                search: form.search || undefined,
                action: form.action !== 'all' ? form.action : undefined,
                user_id: form.user_id !== 'all' ? form.user_id : undefined,
                from: form.from || undefined,
                to: form.to || undefined,
                per_page: form.per_page || undefined,
                page,
            },
            { preserveScroll: true, preserveState: true }
        );
    };

    const clearFilters = () => {
        const next = {
            search: '',
            action: 'all',
            user_id: 'all',
            from: '',
            to: '',
            per_page: '50',
        };
        setForm(next);
        router.get(
            `${adminAppUrl}/system/activity-logs`,
            { per_page: 50 },
            { preserveScroll: true, preserveState: true }
        );
    };

    return (
        <AdminLayout title={t('activity_logs.title')}>
            <Head title={t('activity_logs.title')} />
            <Stack spacing={1.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader title={t('activity_logs.heading')} subtitle={t('activity_logs.subtitle')} />

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                            <TextField
                                size="small"
                                label={t('activity_logs.filters.search')}
                                value={form.search}
                                onChange={(event) => setForm((prev) => ({ ...prev, search: event.target.value }))}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') applyFilters(1);
                                }}
                                fullWidth
                            />
                            <FormControl size="small" fullWidth>
                                <InputLabel>{t('activity_logs.filters.action')}</InputLabel>
                                <Select
                                    label={t('activity_logs.filters.action')}
                                    value={form.action}
                                    onChange={(event) => setForm((prev) => ({ ...prev, action: event.target.value }))}
                                >
                                    <MenuItem value="all">{t('activity_logs.filters.all_actions')}</MenuItem>
                                    {actions.map((action) => (
                                        <MenuItem key={action} value={action}>
                                            {action}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" fullWidth>
                                <InputLabel>{t('activity_logs.filters.user')}</InputLabel>
                                <Select
                                    label={t('activity_logs.filters.user')}
                                    value={form.user_id}
                                    onChange={(event) => setForm((prev) => ({ ...prev, user_id: event.target.value }))}
                                >
                                    <MenuItem value="all">{t('activity_logs.filters.all_users')}</MenuItem>
                                    {users.map((user) => (
                                        <MenuItem key={user.id} value={String(user.id)}>
                                            {user.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                            <TextField
                                size="small"
                                label={t('activity_logs.filters.from')}
                                type="date"
                                value={form.from}
                                onChange={(event) => setForm((prev) => ({ ...prev, from: event.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                            <TextField
                                size="small"
                                label={t('activity_logs.filters.to')}
                                type="date"
                                value={form.to}
                                onChange={(event) => setForm((prev) => ({ ...prev, to: event.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                            <FormControl size="small" fullWidth>
                                <InputLabel>{t('activity_logs.filters.per_page')}</InputLabel>
                                <Select
                                    label={t('activity_logs.filters.per_page')}
                                    value={form.per_page}
                                    onChange={(event) => setForm((prev) => ({ ...prev, per_page: event.target.value }))}
                                >
                                    <MenuItem value="25">25</MenuItem>
                                    <MenuItem value="50">50</MenuItem>
                                    <MenuItem value="100">100</MenuItem>
                                </Select>
                            </FormControl>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
                                <Button variant="contained" onClick={() => applyFilters(1)}>
                                    {t('activity_logs.actions.apply')}
                                </Button>
                                <Button variant="outlined" onClick={clearFilters}>
                                    {t('activity_logs.actions.clear')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {t('activity_logs.results', { count: logs.total ?? rows.length })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('activity_logs.page', { current: logs.current_page ?? 1, last: logs.last_page ?? 1 })}
                        </Typography>
                    </Stack>

                    {isCompact ? (
                        <Stack spacing={1.25}>
                            {rows.map((row) => (
                                <Paper key={row.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack spacing={0.75}>
                                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, wordBreak: 'break-word' }}>
                                                {row.action}
                                            </Typography>
                                            <Chip size="small" label={row.subject_type || t('activity_logs.table.no_subject')} variant="outlined" />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            {row.user_name} · {formatDateTime(row.created_at)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                            {row.details || '—'}
                                        </Typography>
                                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                                            <Typography variant="caption" color="text.secondary">
                                                {t('activity_logs.table.ip')}: {row.ip_address || '—'}
                                            </Typography>
                                            <Button size="small" onClick={() => setSelectedLog(row)}>
                                                {t('activity_logs.actions.view_details')}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            ))}
                            {rows.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    {t('activity_logs.empty')}
                                </Typography>
                            ) : null}
                        </Stack>
                    ) : (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('activity_logs.table.when')}</TableCell>
                                        <TableCell>{t('activity_logs.table.user')}</TableCell>
                                        <TableCell>{t('activity_logs.table.action')}</TableCell>
                                        <TableCell>{t('activity_logs.table.subject')}</TableCell>
                                        <TableCell>{t('activity_logs.table.details')}</TableCell>
                                        <TableCell>{t('activity_logs.table.ip')}</TableCell>
                                        <TableCell align="right">{t('ui.actions')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</TableCell>
                                            <TableCell>{row.user_name}</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>{row.action}</TableCell>
                                            <TableCell>
                                                {row.subject_type || t('activity_logs.table.no_subject')}
                                                {row.subject_id ? ` #${row.subject_id}` : ''}
                                            </TableCell>
                                            <TableCell sx={{ minWidth: 260, wordBreak: 'break-word' }}>{row.details || '—'}</TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.ip_address || '—'}</TableCell>
                                            <TableCell align="right">
                                                <Button size="small" onClick={() => setSelectedLog(row)}>
                                                    {t('activity_logs.actions.view_details')}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('activity_logs.empty')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </Box>
                    )}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
                        <Button variant="outlined" disabled={(logs.current_page ?? 1) <= 1} onClick={() => applyFilters((logs.current_page ?? 1) - 1)}>
                            {t('activity_logs.pagination.previous')}
                        </Button>
                        <Button
                            variant="outlined"
                            disabled={(logs.current_page ?? 1) >= (logs.last_page ?? 1)}
                            onClick={() => applyFilters((logs.current_page ?? 1) + 1)}
                        >
                            {t('activity_logs.pagination.next')}
                        </Button>
                    </Stack>
                </Paper>
            </Stack>

            <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} fullWidth maxWidth="md">
                <DialogTitle>{t('activity_logs.dialog.title')}</DialogTitle>
                <DialogContent>
                    {selectedLog ? (
                        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                            <Typography variant="body2">
                                <strong>{t('activity_logs.table.when')}:</strong> {formatDateTime(selectedLog.created_at)}
                            </Typography>
                            <Typography variant="body2">
                                <strong>{t('activity_logs.table.user')}:</strong> {selectedLog.user_name}
                            </Typography>
                            <Typography variant="body2">
                                <strong>{t('activity_logs.table.action')}:</strong> {selectedLog.action}
                            </Typography>
                            <Typography variant="body2">
                                <strong>{t('activity_logs.table.subject')}:</strong> {selectedLog.subject_type || t('activity_logs.table.no_subject')}
                                {selectedLog.subject_id ? ` #${selectedLog.subject_id}` : ''}
                            </Typography>
                            <Typography variant="body2">
                                <strong>{t('activity_logs.table.ip')}:</strong> {selectedLog.ip_address || '—'}
                            </Typography>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                                    {t('activity_logs.dialog.properties')}
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '12px' }}>
                                        {JSON.stringify(selectedLog.properties ?? {}, null, 2)}
                                    </pre>
                                </Paper>
                            </Box>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedLog(null)}>{t('ui.cancel')}</Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
