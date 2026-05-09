import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Drawer,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    Dashboard as DashboardIcon,
    Insights as InsightsIcon,
    Menu as MenuIcon,
    MoreVert as MoreVertIcon,
    Notifications as NotificationsIcon,
    Palette as PaletteIcon,
    RocketLaunch as RocketLaunchIcon,
    Shield as ShieldIcon,
    Storage as StorageIcon,
    Tune as TuneIcon,
} from '@mui/icons-material';

const metrics = [
    { label: 'Active Users', value: '2,431', change: '+8.3%', tone: 'success' },
    { label: 'Total Courses', value: '186', change: '+2.1%', tone: 'primary' },
    { label: 'Server Errors', value: '19', change: '-12.4%', tone: 'warning' },
    { label: 'Revenue', value: '$12,480', change: '+5.7%', tone: 'success' },
];

const environments = [
    { name: 'Production', region: 'asia-southeast1', status: 'Healthy', traffic: '74%' },
    { name: 'Staging', region: 'asia-east1', status: 'Healthy', traffic: '18%' },
    { name: 'Development', region: 'europe-west1', status: 'Warning', traffic: '8%' },
];

const activity = [
    { title: 'Role policy updated', description: 'Permissions synchronized', time: '2m ago' },
    { title: 'Payments report generated', description: 'Monthly summary complete', time: '15m ago' },
    { title: 'New course published', description: 'Frontend fundamentals', time: '47m ago' },
];

const sidebarSections = [
    { key: 'overview', label: 'Overview', icon: <DashboardIcon fontSize="small" /> },
    { key: 'patterns', label: 'Components & Patterns', icon: <PaletteIcon fontSize="small" /> },
    { key: 'metrics', label: 'Environment Health', icon: <InsightsIcon fontSize="small" /> },
    { key: 'settings', label: 'Design Notes', icon: <TuneIcon fontSize="small" /> },
];

export default function UiShowcase() {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
    const [projectName, setProjectName] = useState('Calamus Admin');
    const [environment, setEnvironment] = useState('production');
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [releaseName, setReleaseName] = useState('Admin UI v1');
    const [ownerEmail, setOwnerEmail] = useState('admin@calamus.app');
    const [releaseChannel, setReleaseChannel] = useState('stable');
    const [notes, setNotes] = useState('Compact spacing, low elevation, and consistent controls.');
    const [anchorEl, setAnchorEl] = useState(null);
    const [tableActionAnchorEl, setTableActionAnchorEl] = useState(null);
    const [selectedEnvironment, setSelectedEnvironment] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const openMenu = Boolean(anchorEl);
    const openTableActionMenu = Boolean(tableActionAnchorEl);

    const handleTableActionOpen = (event, row) => {
        setTableActionAnchorEl(event.currentTarget);
        setSelectedEnvironment(row);
    };

    const handleTableActionClose = () => {
        setTableActionAnchorEl(null);
        setSelectedEnvironment(null);
    };
    const SidebarContent = (
        <>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 36, height: 36 }}>
                        <PaletteIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                            UI Workspace
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            Showcase Mode
                        </Typography>
                    </Box>
                    {isSmallScreen && (
                        <IconButton size="small" onClick={() => setSidebarOpen(false)}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            <List dense sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                {sidebarSections.map((section, index) => (
                    <ListItem key={section.key} disablePadding sx={{ mb: index < sidebarSections.length - 1 ? 0.25 : 0 }}>
                        <Button
                            fullWidth
                            variant={section.key === 'patterns' ? 'contained' : 'text'}
                            sx={{ justifyContent: 'flex-start', gap: 1, py: 0.75, px: 1 }}
                        >
                            {section.icon}
                            {section.label}
                        </Button>
                    </ListItem>
                ))}
            </List>

            <Box sx={{ p: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5, boxShadow: 'none' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Resource Usage</Typography>
                    <Stack spacing={1}>
                        <Box>
                            <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                                <Typography variant="caption">CPU</Typography>
                                <Typography variant="caption">67%</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={67} />
                        </Box>
                        <Box>
                            <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                                <Typography variant="caption">Memory</Typography>
                                <Typography variant="caption">54%</Typography>
                            </Stack>
                            <LinearProgress color="secondary" variant="determinate" value={54} />
                        </Box>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5, boxShadow: 'none' }}>
                    <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Activity Feed</Typography>
                        <Badge color="error" badgeContent={3}>
                            <NotificationsIcon />
                        </Badge>
                    </Stack>
                    <List disablePadding>
                        {activity.map((item) => (
                            <ListItem disableGutters key={item.title} sx={{ py: 0.75 }}>
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 32, height: 32 }}>
                                        <ShieldIcon />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={item.title}
                                    secondary={`${item.description} • ${item.time}`}
                                    primaryTypographyProps={{ fontWeight: 500 }}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 0.75, alignItems: 'center' }}>
                        <StorageIcon color="primary" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Design Notes</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Keep spacing in 8px grid, prefer rounded cards, and use contained buttons for main actions.
                    </Typography>
                </Paper>
            </Box>
        </>
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100vh' }}>
            <Head title="UI Showcase" />

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ mb: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        UI Showcase
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Design reference inspired by the Calamus admin style.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {isSmallScreen && (
                        <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setSidebarOpen(true)}>
                            Workspace
                        </Button>
                    )}
                    <Button variant="outlined" size="small" startIcon={<PaletteIcon />}>Theme Tokens</Button>
                    <Button variant="contained" size="small" startIcon={<RocketLaunchIcon />}>Primary Action</Button>
                </Stack>
            </Stack>

            <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {metrics.map((metric) => (
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={metric.label}>
                        <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none' }}>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                                <Typography variant="h5" sx={{ mt: 0.5, mb: 1, fontWeight: 700, lineHeight: 1.1 }}>
                                    {metric.value}
                                </Typography>
                                <Chip size="small" label={metric.change} color={metric.tone} />
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ display: { xs: 'block', lg: 'flex' }, gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                        <Stack direction="row" sx={{ mb: 1.25, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Components & Patterns</Typography>
                            <IconButton size="small"><MoreVertIcon /></IconButton>
                        </Stack>
                        <Divider sx={{ mb: 1.5 }} />
                        <Grid container spacing={1.25}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Project Name"
                                    value={projectName}
                                    onChange={(event) => setProjectName(event.target.value)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Environment"
                                    value={environment}
                                    onChange={(event) => setEnvironment(event.target.value)}
                                >
                                    <MenuItem value="production">Production</MenuItem>
                                    <MenuItem value="staging">Staging</MenuItem>
                                    <MenuItem value="development">Development</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <FormControlLabel
                                    control={<Switch checked={alertsEnabled} onChange={(event) => setAlertsEnabled(event.target.checked)} />}
                                    label="Enable platform alerts"
                                />
                            </Grid>
                        </Grid>
                    </Paper>

                    <Paper variant="outlined" sx={{ mt: 1.5, p: 2, borderRadius: 2, boxShadow: 'none' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.25 }}>Form Design</Typography>
                        <Grid container spacing={1.25}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Release Name"
                                    value={releaseName}
                                    onChange={(event) => setReleaseName(event.target.value)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Owner Email"
                                    value={ownerEmail}
                                    onChange={(event) => setOwnerEmail(event.target.value)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Release Channel</InputLabel>
                                    <Select
                                        label="Release Channel"
                                        value={releaseChannel}
                                        onChange={(event) => setReleaseChannel(event.target.value)}
                                    >
                                        <MenuItem value="stable">Stable</MenuItem>
                                        <MenuItem value="beta">Beta</MenuItem>
                                        <MenuItem value="canary">Canary</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    size="small"
                                    label="Release Notes"
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                    <Button size="small" variant="text" onClick={(e) => setAnchorEl(e.currentTarget)} endIcon={<KeyboardArrowDownIcon />}>
                                        More Options
                                    </Button>
                                    <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
                                        <MenuItem onClick={() => setAnchorEl(null)} dense>Export as PDF</MenuItem>
                                        <MenuItem onClick={() => setAnchorEl(null)} dense>Export as JSON</MenuItem>
                                    </Menu>
                                    <Button size="small" variant="outlined" onClick={() => setDialogOpen(true)}>Review & Save</Button>
                                    <Button size="small" variant="contained">Publish</Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                        <DialogTitle sx={{ fontWeight: 600 }}>Confirm Release Publication</DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                You are about to publish <strong>{releaseName}</strong> to <strong>{environment}</strong>.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, pt: 1 }}>
                            <Button onClick={() => setDialogOpen(false)} size="small">Cancel</Button>
                            <Button onClick={() => setDialogOpen(false)} variant="contained" size="small">Confirm</Button>
                        </DialogActions>
                    </Dialog>

                    <Paper variant="outlined" sx={{ mt: 1.5, borderRadius: 2, overflow: 'hidden', boxShadow: 'none' }}>
                        <Box sx={{ px: 2, py: 1.25 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Environment Health</Typography>
                        </Box>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Region</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Traffic</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {environments.map((row) => (
                                        <TableRow key={row.name} hover>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell>{row.region}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={row.status} color={row.status === 'Healthy' ? 'success' : 'warning'} />
                                            </TableCell>
                                            <TableCell>{row.traffic}</TableCell>
                                            <TableCell align="right" sx={{ width: 56 }}>
                                                <IconButton size="small" onClick={(event) => handleTableActionOpen(event, row)}>
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Menu
                            anchorEl={tableActionAnchorEl}
                            open={openTableActionMenu}
                            onClose={handleTableActionClose}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            <MenuItem onClick={handleTableActionClose} dense>
                                View {selectedEnvironment?.name || 'environment'}
                            </MenuItem>
                            <MenuItem onClick={handleTableActionClose} dense>
                                Edit {selectedEnvironment?.name || 'environment'}
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleTableActionClose} dense sx={{ color: 'error.main' }}>
                                Remove
                            </MenuItem>
                        </Menu>
                    </Paper>
                </Box>

                {!isSmallScreen && (
                    <Paper
                        variant="outlined"
                        sx={{
                            width: 300,
                            borderRadius: 2,
                            overflow: 'hidden',
                            position: 'sticky',
                            top: 72,
                        }}
                    >
                        {SidebarContent}
                    </Paper>
                )}
            </Box>

            <Drawer
                anchor="right"
                open={isSmallScreen && sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                ModalProps={{
                    BackdropProps: {
                        sx: {
                            top: '48px',
                            height: 'calc(100% - 48px)',
                        },
                    },
                }}
                sx={{
                    '& .MuiDrawer-paper': {
                        top: '48px !important',
                        height: 'calc(100% - 48px) !important',
                    },
                }}
                PaperProps={{
                    sx: {
                        width: 320,
                        maxWidth: '88vw',
                    },
                }}
            >
                {SidebarContent}
            </Drawer>
        </Box>
    );
}

UiShowcase.layout = (page) => <AdminLayout title="UI Showcase" children={page} />;
