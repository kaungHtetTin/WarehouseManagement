import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Drawer,
    Grid,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    Paper,
    Slider,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Apartment as ApartmentIcon,
    Brush as BrushIcon,
    Close as CloseIcon,
    Menu as MenuIcon,
    Public as PublicIcon,
    Save as SaveIcon,
    Settings as SettingsIcon,
    Tag as TagIcon,
    Upload as UploadIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const sectionCardSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: 'none',
};

function SettingsCard({ children, sx }) {
    return (
        <Paper elevation={0} sx={[sectionCardSx, sx]}>
            {children}
        </Paper>
    );
}

export default function OrganizationSettings() {
    const page = usePage();
    const pageProps = page.props;
    const adminAppUrl = pageProps.admin_app_url;
    const organization = pageProps.organization;
    const publicPage = pageProps.publicPage;
    const flash = pageProps.flash ?? {};

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const tab = new URL(page.url, window.location.origin).searchParams.get('tab');
            return tab === 'public' ? 'public' : 'settings';
        } catch {
            return 'settings';
        }
    });

    const initialThemeColor = publicPage?.theme_color || '#3B82F6';

    const form = useForm({
        name: organization?.name ?? '',
        theme_color: initialThemeColor,
    });

    const publicForm = useForm({
        slug: publicPage?.slug ?? '',
        is_published: Boolean(publicPage?.is_published),
        business_name: publicPage?.business_name ?? organization?.name ?? '',
        about: publicPage?.about ?? '',
        phone: publicPage?.phone ?? '',
        email: publicPage?.email ?? '',
        address: publicPage?.address ?? '',
        website_url: publicPage?.website_url ?? '',
        facebook_url: publicPage?.facebook_url ?? '',
        cover_url: publicPage?.cover_url ?? '',
    });

    const uploadForm = useForm({ logo: null });
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

    const [cropOpen, setCropOpen] = useState(false);
    const [img, setImg] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const previewUrl = useMemo(() => {
        const slug = publicPage?.slug;
        return slug ? `/p/${slug}` : null;
    }, [publicPage?.slug]);

    const updateUrlTab = (tabKey) => {
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('tab', tabKey);
            window.history.replaceState(null, '', `${u.pathname}?${u.searchParams.toString()}${u.hash}`);
        } catch {
            return;
        }
    };

    const workspaceItems = useMemo(() => {
        return [
            { key: 'settings', label: 'Settings', icon: <SettingsIcon fontSize="small" /> },
            { key: 'public', label: 'Public Page', icon: <PublicIcon fontSize="small" /> },
        ];
    }, []);

    const submit = (e) => {
        e.preventDefault();
        form.patch(`${adminAppUrl}/system/organization-settings`, { preserveScroll: true });
    };

    const submitPublic = (e) => {
        e.preventDefault();
        publicForm.patch(`${adminAppUrl}/system/public-page`, { preserveScroll: true });
    };

    const handleTabChange = (nextTab) => {
        setActiveTab(nextTab);
        updateUrlTab(nextTab);
    };

    const openFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const cleanupImageUrl = () => {
        if (imgUrl) {
            URL.revokeObjectURL(imgUrl);
        }
    };

    const closeCropper = () => {
        cleanupImageUrl();
        setImgUrl(null);
        setImg(null);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setCropOpen(false);
        uploadForm.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const loadImage = (file) => {
        cleanupImageUrl();
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            setImgUrl(url);
            setImg(image);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
            setCropOpen(true);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
        };
        image.src = url;
    };

    const onFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file);
    };

    const clampOffset = (x, y, imgW, imgH, scale, size) => {
        const sw = imgW * scale;
        const sh = imgH * scale;
        const maxX = Math.max(0, (sw - size) / 2);
        const maxY = Math.max(0, (sh - size) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const baseScale = Math.max(size / imgW, size / imgH);
        const scale = baseScale * zoom;
        const clamped = clampOffset(offset.x, offset.y, imgW, imgH, scale, size);
        if (clamped.x !== offset.x || clamped.y !== offset.y) {
            setOffset(clamped);
            return;
        }

        const sw = imgW * scale;
        const sh = imgH * scale;
        const dx = (size - sw) / 2 + clamped.x;
        const dy = (size - sh) / 2 + clamped.y;

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, sw, sh);
    }, [img, zoom, offset]);

    useEffect(() => {
        draw();
    }, [draw]);

    const onPointerDown = (e) => {
        if (!img) return;
        dragRef.current.active = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.baseX = offset.x;
        dragRef.current.baseY = offset.y;
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        if (!dragRef.current.active || !img) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
    };

    const onPointerUp = (e) => {
        dragRef.current.active = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    const uploadCroppedLogo = () => {
        if (!img) return;

        const previewSize = 240;
        const outputSize = 512;

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        const baseScalePreview = Math.max(previewSize / imgW, previewSize / imgH);
        const scalePreview = baseScalePreview * zoom;
        const clampedPreview = clampOffset(offset.x, offset.y, imgW, imgH, scalePreview, previewSize);

        const baseScaleOut = Math.max(outputSize / imgW, outputSize / imgH);
        const scaleOut = baseScaleOut * zoom;
        const scaledOffset = {
            x: clampedPreview.x * (outputSize / previewSize),
            y: clampedPreview.y * (outputSize / previewSize),
        };
        const clampedOut = clampOffset(scaledOffset.x, scaledOffset.y, imgW, imgH, scaleOut, outputSize);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outputSize;
        outCanvas.height = outputSize;
        const ctx = outCanvas.getContext('2d');

        const sw = imgW * scaleOut;
        const sh = imgH * scaleOut;
        const dx = (outputSize - sw) / 2 + clampedOut.x;
        const dy = (outputSize - sh) / 2 + clampedOut.y;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, outputSize, outputSize);
        ctx.drawImage(img, dx, dy, sw, sh);

        outCanvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], 'logo.png', { type: 'image/png' });
                uploadForm.setData('logo', file);
                uploadForm.post(`${adminAppUrl}/system/organization-settings/logo`, {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => {
                        closeCropper();
                    },
                });
            },
            'image/png',
            0.92,
        );
    };

    const SidebarContent = (
        <>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <Avatar
                        src={publicPage?.logo_url || undefined}
                        sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 40, height: 40 }}
                    >
                        <SettingsIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                            Settings Workspace
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {organization?.name || 'Organization'} {organization?.code ? `• ${organization.code}` : ''}
                        </Typography>
                    </Box>
                    {isSmallScreen && (
                        <IconButton size="small" onClick={() => setSidebarOpen(false)}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            <Box sx={{ p: 2 }}>
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <List dense sx={{ p: 0.75 }}>
                        {workspaceItems.map((item) => {
                            const active = activeTab === item.key;
                            return (
                                <ListItem key={item.key} disablePadding sx={{ mb: 0.25 }}>
                                    <Button
                                        fullWidth
                                        variant={active ? 'contained' : 'text'}
                                        sx={{ justifyContent: 'flex-start', gap: 1, py: 0.85, px: 1.1, borderRadius: 1.5 }}
                                        onClick={() => {
                                            handleTabChange(item.key);
                                            if (isSmallScreen) {
                                                setSidebarOpen(false);
                                            }
                                        }}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </Button>
                                </ListItem>
                            );
                        })}
                    </List>
                </Paper>

                <Divider sx={{ my: 1.75 }} />

                {previewUrl ? (
                    <Stack spacing={0.75}>
                        <Typography variant="caption" color="text.secondary">
                            Public preview
                        </Typography>
                        <Button
                            component={Link}
                            href={previewUrl}
                            variant="outlined"
                            size="small"
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            {previewUrl}
                        </Button>
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        Public page preview is not available yet.
                    </Typography>
                )}
            </Box>
        </>
    );

    return (
        <AdminLayout title="Settings">
            <Head title="Settings" />
            <Box
                sx={{
                    display: { xs: 'block', lg: 'flex' },
                    gap: 1.5,
                    alignItems: 'flex-start',
                    p: { xs: 0, sm: 0 },
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack spacing={2.5}>
                        {flash.success && <Alert severity="success">{flash.success}</Alert>}
                        {flash.error && <Alert severity="error">{flash.error}</Alert>}

                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.5}
                            sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
                        >
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                    Settings
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {organization?.name || 'Organization'}
                                    {organization?.code ? ` (${organization.code})` : ''}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                {isSmallScreen && (
                                    <Button variant="outlined" size="small" startIcon={<MenuIcon />} onClick={() => setSidebarOpen(true)}>
                                        Workspace
                                    </Button>
                                )}
                                {activeTab === 'settings' ? (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disabled={form.processing}
                                        onClick={(e) => submit(e)}
                                        startIcon={form.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                    >
                                        Save
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disabled={publicForm.processing}
                                        onClick={(e) => submitPublic(e)}
                                        startIcon={publicForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                    >
                                        Save
                                    </Button>
                                )}
                            </Stack>
                        </Stack>

                        {activeTab === 'settings' ? (
                            <Box component="form" onSubmit={submit} noValidate>
                                <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 12, md: 7 }}>
                                        <SettingsCard>
                                            <Stack spacing={1.5}>
                                                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 2.25,
                                                            bgcolor: 'rgba(59,130,246,0.10)',
                                                            color: '#3B82F6',
                                                        }}
                                                    >
                                                        <ApartmentIcon fontSize="small" />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                                            Organization
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Manage your organization information and unique code.
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                <Divider />
                                                <TextField
                                                    required
                                                    label="Name"
                                                    value={form.data.name}
                                                    onChange={(e) => form.setData('name', e.target.value)}
                                                    error={Boolean(form.errors.name)}
                                                    helperText={form.errors.name}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <ApartmentIcon fontSize="small" />
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                />
                                                <TextField
                                                    label="Code"
                                                    value={organization?.code || ''}
                                                    disabled
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <TagIcon fontSize="small" />
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                    helperText="This code is used to identify your organization."
                                                />
                                            </Stack>
                                        </SettingsCard>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <SettingsCard>
                                            <Stack spacing={1.5}>
                                                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 2.25,
                                                            bgcolor: 'rgba(168,85,247,0.10)',
                                                            color: '#A855F7',
                                                        }}
                                                    >
                                                        <BrushIcon fontSize="small" />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                                            Branding
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Customize your brand identity and theme.
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                <Divider />
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={onFileChange}
                                                />
                                                <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                                                    <Box
                                                        sx={{
                                                            width: 88,
                                                            height: 88,
                                                            borderRadius: 3,
                                                            border: '1px dashed',
                                                            borderColor: 'divider',
                                                            bgcolor: 'rgba(15,23,42,0.02)',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        {publicPage?.logo_url ? (
                                                            <Box
                                                                component="img"
                                                                src={publicPage.logo_url}
                                                                alt="Logo"
                                                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <BrushIcon sx={{ color: 'text.disabled' }} />
                                                        )}
                                                    </Box>
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                            Upload logo
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Upload and crop 1:1
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            PNG, JPG up to 2MB
                                                        </Typography>
                                                        {uploadForm.errors.logo ? (
                                                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                                {uploadForm.errors.logo}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={openFilePicker}
                                                        disabled={uploadForm.processing}
                                                        startIcon={<UploadIcon fontSize="small" />}
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Upload
                                                    </Button>
                                                </Stack>

                                                <Stack spacing={1}>
                                                    <Divider />
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                        Theme color
                                                    </Typography>
                                                    <Grid container spacing={1.25}>
                                                        <Grid size={{ xs: 12, sm: 6 }}>
                                                            <TextField
                                                                label="Color"
                                                                type="color"
                                                                value={form.data.theme_color}
                                                                onChange={(e) => form.setData('theme_color', e.target.value)}
                                                                inputProps={{ style: { height: 40, padding: 6 } }}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, sm: 6 }}>
                                                            <TextField
                                                                label="Hex"
                                                                value={form.data.theme_color}
                                                                onChange={(e) => form.setData('theme_color', e.target.value)}
                                                                error={Boolean(form.errors.theme_color)}
                                                                helperText={form.errors.theme_color || 'Example: #3B82F6'}
                                                                inputProps={{ inputMode: 'text' }}
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                </Stack>
                                            </Stack>
                                        </SettingsCard>
                                    </Grid>
                                </Grid>
                            </Box>
                        ) : (
                            <Box component="form" onSubmit={submitPublic} noValidate>
                                <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <SettingsCard>
                                            <Stack spacing={1.5}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                    Publishing
                                                </Typography>
                                                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Status
                                                    </Typography>
                                                    <Button
                                                        variant={publicForm.data.is_published ? 'contained' : 'outlined'}
                                                        color={publicForm.data.is_published ? 'success' : 'inherit'}
                                                        onClick={() => publicForm.setData('is_published', !publicForm.data.is_published)}
                                                        disabled={publicForm.processing}
                                                    >
                                                        {publicForm.data.is_published ? 'Published' : 'Unpublished'}
                                                    </Button>
                                                </Stack>
                                                <TextField
                                                    required
                                                    label="Slug"
                                                    value={publicForm.data.slug}
                                                    onChange={(e) => publicForm.setData('slug', e.target.value)}
                                                    error={Boolean(publicForm.errors.slug)}
                                                    helperText={publicForm.errors.slug || 'Public URL will be /p/{slug}'}
                                                />
                                                <TextField
                                                    label="Business name"
                                                    value={publicForm.data.business_name}
                                                    onChange={(e) => publicForm.setData('business_name', e.target.value)}
                                                    error={Boolean(publicForm.errors.business_name)}
                                                    helperText={publicForm.errors.business_name}
                                                />
                                                <TextField
                                                    label="About"
                                                    multiline
                                                    minRows={4}
                                                    value={publicForm.data.about}
                                                    onChange={(e) => publicForm.setData('about', e.target.value)}
                                                    error={Boolean(publicForm.errors.about)}
                                                    helperText={publicForm.errors.about}
                                                />
                                            </Stack>
                                        </SettingsCard>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Stack spacing={1.5}>
                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        Contact
                                                    </Typography>
                                                    <TextField
                                                        label="Phone"
                                                        value={publicForm.data.phone}
                                                        onChange={(e) => publicForm.setData('phone', e.target.value)}
                                                        error={Boolean(publicForm.errors.phone)}
                                                        helperText={publicForm.errors.phone}
                                                    />
                                                    <TextField
                                                        label="Email"
                                                        value={publicForm.data.email}
                                                        onChange={(e) => publicForm.setData('email', e.target.value)}
                                                        error={Boolean(publicForm.errors.email)}
                                                        helperText={publicForm.errors.email}
                                                    />
                                                    <TextField
                                                        label="Address"
                                                        value={publicForm.data.address}
                                                        onChange={(e) => publicForm.setData('address', e.target.value)}
                                                        error={Boolean(publicForm.errors.address)}
                                                        helperText={publicForm.errors.address}
                                                    />
                                                </Stack>
                                            </SettingsCard>
                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        Links
                                                    </Typography>
                                                    <TextField
                                                        label="Website URL"
                                                        value={publicForm.data.website_url}
                                                        onChange={(e) => publicForm.setData('website_url', e.target.value)}
                                                        error={Boolean(publicForm.errors.website_url)}
                                                        helperText={publicForm.errors.website_url}
                                                    />
                                                    <TextField
                                                        label="Facebook URL"
                                                        value={publicForm.data.facebook_url}
                                                        onChange={(e) => publicForm.setData('facebook_url', e.target.value)}
                                                        error={Boolean(publicForm.errors.facebook_url)}
                                                        helperText={publicForm.errors.facebook_url}
                                                    />
                                                </Stack>
                                            </SettingsCard>
                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        Cover
                                                    </Typography>
                                                    <TextField
                                                        label="Cover URL"
                                                        value={publicForm.data.cover_url}
                                                        onChange={(e) => publicForm.setData('cover_url', e.target.value)}
                                                        error={Boolean(publicForm.errors.cover_url)}
                                                        helperText={publicForm.errors.cover_url}
                                                    />
                                                </Stack>
                                            </SettingsCard>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}
                    </Stack>
                </Box>

                {!isSmallScreen && (
                    <Paper
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

            <Dialog open={cropOpen} onClose={() => !uploadForm.processing && closeCropper()} fullWidth maxWidth="xs">
                <DialogTitle>Crop logo (1:1)</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Box
                            sx={{
                                width: 240,
                                height: 240,
                                mx: 'auto',
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider',
                                touchAction: 'none',
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                width={240}
                                height={240}
                                style={{ width: 240, height: 240, display: 'block', cursor: img ? 'grab' : 'default' }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                            />
                        </Box>
                        <Stack spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                Zoom
                            </Typography>
                            <Slider
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.01}
                                onChange={(_, value) => setZoom(Array.isArray(value) ? value[0] : value)}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                            />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            Drag to reposition
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeCropper} disabled={uploadForm.processing}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={uploadCroppedLogo} disabled={!img || uploadForm.processing}>
                        Save logo
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
