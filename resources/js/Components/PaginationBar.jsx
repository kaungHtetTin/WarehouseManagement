import { FormControl, InputLabel, MenuItem, Pagination, Paper, Select, Stack, Typography } from '@mui/material';

const DEFAULT_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function PaginationBar({
    pagination,
    onPageChange,
    onPerPageChange,
    itemLabel = 'items',
    perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
}) {
    const currentPage = Number(pagination?.current_page ?? 1);
    const lastPage = Math.max(Number(pagination?.last_page ?? 1), 1);
    const perPage = Number(pagination?.per_page ?? perPageOptions[0]);
    const total = Number(pagination?.total ?? 0);
    const from = Number(pagination?.from ?? 0);
    const to = Number(pagination?.to ?? 0);

    return (
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, boxShadow: 'none' }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
            >
                <Typography variant="body2" color="text.secondary">
                    {total > 0 ? `${from}-${to} of ${total} ${itemLabel}` : `0 ${itemLabel}`}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 132 }}>
                        <InputLabel id="pagination-per-page-label">Rows per page</InputLabel>
                        <Select
                            labelId="pagination-per-page-label"
                            label="Rows per page"
                            value={String(perPage)}
                            onChange={(event) => onPerPageChange(Number(event.target.value))}
                        >
                            {perPageOptions.map((option) => (
                                <MenuItem key={option} value={String(option)}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Pagination
                        count={lastPage}
                        page={Math.min(currentPage, lastPage)}
                        onChange={(_, page) => onPageChange(page)}
                        color="primary"
                        shape="rounded"
                        size="small"
                        showFirstButton
                        showLastButton
                    />
                </Stack>
            </Stack>
        </Paper>
    );
}
