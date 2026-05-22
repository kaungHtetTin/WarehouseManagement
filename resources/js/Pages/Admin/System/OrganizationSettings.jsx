import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Drawer,
    FormControlLabel,
    Grid,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    MenuItem,
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
    OpenInNew as OpenInNewIcon,
    Menu as MenuIcon,
    Public as PublicIcon,
    ReceiptLong as VoucherIcon,
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

function coerceArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function n2(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function safeStr(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function fmtQty(value) {
    const n = n2(value);
    if (n == null) return '—';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}

function fmtMoney(value) {
    const n = n2(value);
    if (n == null) return '—';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
}

function VoucherPrintLivePreview({ voucher, template }) {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const isReceipt = String(template?.paper_size || '').toUpperCase() === 'RECEIPT_80';
    const sheetWidth = isReceipt ? 302 : 794;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const compute = () => {
            const w = el.clientWidth || 1;
            const minScale = isReceipt ? 0.8 : 0.45;
            const maxScale = isReceipt ? 1.9 : 1.05;
            const next = Math.min(maxScale, Math.max(minScale, w / sheetWidth));
            setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
        };

        compute();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', compute);
            return () => window.removeEventListener('resize', compute);
        }

        const ro = new ResizeObserver(() => compute());
        ro.observe(el);
        return () => ro.disconnect();
    }, [sheetWidth, isReceipt]);

    const freightTotal = useMemo(() => {
        const items = Array.isArray(voucher?.items) ? voucher.items : [];
        let sum = 0;
        for (const it of items) {
            const n = n2(it?.freight_amount);
            if (n == null) continue;
            sum += n;
        }
        return Math.round(sum * 100) / 100;
    }, [voucher?.items]);

    const paymentsTotal = useMemo(() => {
        const rows = Array.isArray(voucher?.payments) ? voucher.payments : [];
        let sum = 0;
        for (const row of rows) {
            const n = n2(row?.amount);
            if (n == null) continue;
            sum += n;
        }
        return Math.round(sum * 100) / 100;
    }, [voucher?.payments]);

    const headerTitle = safeStr(template?.header_title) || 'Voucher';
    const headerSubtitle = safeStr(template?.header_subtitle);
    const showLogo = Boolean(template?.show_logo);
    const logoUrl = safeStr(template?.logo_url);
    const showContact = Boolean(template?.show_contact);
    const contactPhone = safeStr(template?.contact_phone);
    const contactEmail = safeStr(template?.contact_email);
    const contactAddress = safeStr(template?.contact_address);
    const footerNote = safeStr(template?.footer_note);
    const showPaymentStatus = Boolean(template?.show_payment_status);
    const showSignature = Boolean(template?.show_signature_boxes);

    const fromWarehouseName = voucher?.source_warehouse?.display_name || voucher?.source_warehouse?.city || '—';
    const toWarehouseName = voucher?.default_to_warehouse?.display_name || voucher?.default_to_warehouse?.city || '—';

    return (
        <Box ref={containerRef} sx={{ width: '100%', overflowX: 'auto' }}>
            <Box sx={{ width: sheetWidth * scale, mx: 'auto' }}>
                <Box
                    sx={{
                        width: sheetWidth,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        bgcolor: '#fff',
                    }}
                >
                <Box sx={{ p: isReceipt ? 1.25 : 2 }}>
                    <Stack spacing={1.25}>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                                {showLogo && logoUrl ? (
                                    <Box component="img" src={logoUrl} alt="Logo" sx={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 1 }} />
                                ) : null}
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant={isReceipt ? 'body1' : 'subtitle1'} sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                                        {headerTitle}
                                    </Typography>
                                    {headerSubtitle ? (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                            {headerSubtitle}
                                        </Typography>
                                    ) : null}
                                </Box>
                            </Stack>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                    {voucher?.voucher_no || '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                    {voucher?.voucher_date || '—'}
                                </Typography>
                            </Box>
                        </Stack>

                        {showContact && (contactPhone || contactEmail || contactAddress) ? (
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                {[contactPhone ? `Phone: ${contactPhone}` : null, contactEmail ? `Email: ${contactEmail}` : null, contactAddress || null]
                                    .filter(Boolean)
                                    .join(' • ')}
                            </Typography>
                        ) : null}

                        <Divider />

                        <Box sx={{ display: 'grid', gridTemplateColumns: isReceipt ? '110px 1fr' : '140px 1fr', gap: '6px 12px' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                From warehouse
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {fromWarehouseName}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Destination warehouse
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {toWarehouseName}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Recipient
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {voucher?.default_recipient_name || '—'}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Recipient phone
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {voucher?.default_recipient_phone || '—'}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Destination address
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {voucher?.default_to_address_line1 || '—'}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Remark
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                {voucher?.default_destination_remark || '—'}
                            </Typography>

                            {showPaymentStatus ? (
                                <>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        Payment status
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                        {voucher?.payment_status || '—'}
                                    </Typography>
                                </>
                            ) : null}
                        </Box>

                        <Divider />

                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                            Items
                        </Typography>
                        <Box sx={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1, overflow: 'hidden' }}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: isReceipt ? '36px 1fr 70px' : '52px 1fr 110px 80px',
                                    bgcolor: 'rgba(0,0,0,0.03)',
                                    p: 1,
                                }}
                            >
                                {(isReceipt ? ['No', 'Item', 'Qty'] : ['No', 'Item', 'Qty', 'Fragile']).map((h) => (
                                    <Typography key={h} variant="caption" sx={{ fontWeight: 900 }}>
                                        {h}
                                    </Typography>
                                ))}
                            </Box>
                            {(voucher?.items || []).map((it, idx) => (
                                <Box
                                    key={it?.id || idx}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: isReceipt ? '36px 1fr 70px' : '52px 1fr 110px 80px',
                                        p: 1,
                                        borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.08)',
                                    }}
                                >
                                    <Typography variant="caption">{idx + 1}</Typography>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                            {it?.product?.name || '—'}
                                        </Typography>
                                        {it?.description ? (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                                                {it.description}
                                            </Typography>
                                        ) : null}
                                    </Box>
                                    <Typography variant="caption" sx={{ textAlign: 'right' }}>
                                        {fmtQty(it?.qty)}
                                    </Typography>
                                    {isReceipt ? null : <Typography variant="caption">{it?.is_fragile ? 'Yes' : 'No'}</Typography>}
                                </Box>
                            ))}
                        </Box>

                        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                            <Box sx={{ minWidth: isReceipt ? 1 : 260, width: isReceipt ? '100%' : 'auto' }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        Client payable
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 900, textAlign: 'right' }}>
                                        {fmtMoney(freightTotal)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        Paid
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 900, textAlign: 'right' }}>
                                        {fmtMoney(paymentsTotal)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Stack>

                        {showSignature ? (
                            <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
                                {['Prepared by', 'Checked by', 'Received by'].map((label) => (
                                    <Box key={label} sx={{ flex: 1 }}>
                                        <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.55)', height: 34 }} />
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                                            {label}
                                        </Typography>
                                    </Box>
                                ))}
                            </Stack>
                        ) : null}

                        {footerNote ? (
                            <Typography variant="caption" color="text.secondary" sx={{ pt: 1, textAlign: 'center' }}>
                                {footerNote}
                            </Typography>
                        ) : null}
                    </Stack>
                </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default function OrganizationSettings() {
    const page = usePage();
    const pageProps = page.props;
    const appUrl = pageProps.app_url;
    const adminAppUrl = pageProps.admin_app_url;
    const organization = pageProps.organization;
    const publicPage = pageProps.publicPage;
    const voucherPrintTemplate = pageProps.voucherPrintTemplate;
    const flash = pageProps.flash ?? {};

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
    const isWorkspacePinned = useMediaQuery(theme.breakpoints.up('md'));
    const isWorkspaceOverlay = !isWorkspacePinned;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const tab = new URL(page.url, window.location.origin).searchParams.get('tab');
            if (tab === 'public') return 'public';
            if (tab === 'voucher_print') return 'voucher_print';
            return 'settings';
        } catch {
            return 'settings';
        }
    });

    const initialThemeColor = publicPage?.theme_color || '#3B82F6';
    const defaultThemeColor = useMemo(() => {
        const raw = typeof initialThemeColor === 'string' ? initialThemeColor.trim() : '';
        const normalized = raw.startsWith('#') ? raw : `#${raw}`;
        return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : '#3B82F6';
    }, [initialThemeColor]);

    const form = useForm({
        name: organization?.name ?? '',
        theme_color: defaultThemeColor,
    });

    const publicForm = useForm({
        slug: publicPage?.slug ?? '',
        is_published: Boolean(publicPage?.is_published),
        business_name: publicPage?.business_name ?? organization?.name ?? '',
        about: publicPage?.about ?? '',
        phone: publicPage?.phone ?? '',
        email: publicPage?.email ?? '',
        address: publicPage?.address ?? '',
        kpis: coerceArray(publicPage?.kpis),
        services: coerceArray(publicPage?.services),
        faqs: coerceArray(publicPage?.faqs),
        gallery: coerceArray(publicPage?.gallery),
    });

    const voucherPrintForm = useForm({
        paper_size: voucherPrintTemplate?.paper_size ?? 'A4',
        header_title: voucherPrintTemplate?.header_title ?? organization?.name ?? '',
        header_subtitle: voucherPrintTemplate?.header_subtitle ?? 'Voucher',
        show_logo: Boolean(voucherPrintTemplate?.show_logo),
        logo_url: voucherPrintTemplate?.logo_url ?? '',
        show_contact: Boolean(voucherPrintTemplate?.show_contact),
        contact_phone: voucherPrintTemplate?.contact_phone ?? '',
        contact_email: voucherPrintTemplate?.contact_email ?? '',
        contact_address: voucherPrintTemplate?.contact_address ?? '',
        footer_note: voucherPrintTemplate?.footer_note ?? '',
        show_payment_status: Boolean(voucherPrintTemplate?.show_payment_status),
        show_signature_boxes: Boolean(voucherPrintTemplate?.show_signature_boxes),
    });

    const voucherPrintPreviewVoucher = useMemo(() => {
        const date = new Date().toISOString().slice(0, 10);
        return {
            voucher_no: 'PREVIEW-V-0001',
            voucher_date: date,
            payment_status: 'UNPAID',
            source_warehouse: { display_name: 'Yangon Warehouse', city: 'Yangon' },
            default_to_warehouse: { display_name: 'Mandalay Warehouse', city: 'Mandalay' },
            default_recipient_name: 'Receiver Name',
            default_recipient_phone: '09XXXXXXXXX',
            default_to_address_line1: 'Street / Township / City',
            default_destination_remark: 'Handle with care.',
            additional_costs: [{ amount: 2000 }, { amount: 1500 }],
            items: [
                { id: 1, qty: 10, is_fragile: false, description: 'Sample note', product: { name: 'Carton Box' } },
                { id: 2, qty: 2.5, is_fragile: true, description: null, product: { name: 'Glass Item' } },
                { id: 3, qty: 1, is_fragile: false, description: null, product: { name: 'Spare Parts' } },
            ],
        };
    }, []);

    const voucherPrintPreviewTemplate = useMemo(() => {
        const logoFromPublic = safeStr(publicPage?.logo_url);
        return {
            paper_size: voucherPrintForm.data.paper_size,
            header_title: voucherPrintForm.data.header_title,
            header_subtitle: voucherPrintForm.data.header_subtitle,
            show_logo: voucherPrintForm.data.show_logo,
            logo_url: safeStr(voucherPrintForm.data.logo_url) || logoFromPublic || '',
            show_contact: voucherPrintForm.data.show_contact,
            contact_phone: voucherPrintForm.data.contact_phone,
            contact_email: voucherPrintForm.data.contact_email,
            contact_address: voucherPrintForm.data.contact_address,
            footer_note: voucherPrintForm.data.footer_note,
            show_payment_status: voucherPrintForm.data.show_payment_status,
            show_signature_boxes: voucherPrintForm.data.show_signature_boxes,
        };
    }, [voucherPrintForm.data, publicPage?.logo_url]);

    const logoUploadForm = useForm({ logo: null });
    const voucherPrintLogoUploadForm = useForm({ logo: null });
    const coverUploadForm = useForm({ cover: null });
    const galleryUploadForm = useForm({ photo: null });
    const logoFileInputRef = useRef(null);
    const voucherPrintLogoFileInputRef = useRef(null);
    const coverFileInputRef = useRef(null);
    const galleryFileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

    const [cropOpen, setCropOpen] = useState(false);
    const [cropMode, setCropMode] = useState('logo');
    const [img, setImg] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [removedGalleryUrls, setRemovedGalleryUrls] = useState([]);
    const [themeHex, setThemeHex] = useState(() => defaultThemeColor);

    useEffect(() => {
        const raw = typeof form.data.theme_color === 'string' ? form.data.theme_color.trim() : '';
        const normalized = raw.startsWith('#') ? raw : `#${raw}`;
        if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return;
        const next = normalized.toUpperCase();
        setThemeHex((prev) => (prev === next ? prev : next));
    }, [form.data.theme_color]);

    const themePresets = useMemo(
        () => ['#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#F97316', '#F59E0B', '#22C55E', '#14B8A6', '#0EA5E9', '#64748B'],
        [],
    );

    const setThemeColor = useCallback(
        (value) => {
            const raw = typeof value === 'string' ? value.trim() : '';
            const normalized = raw.startsWith('#') ? raw : `#${raw}`;
            if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return;
            const next = normalized.toUpperCase();
            form.setData('theme_color', next);
            setThemeHex(next);
        },
        [form],
    );

    const onThemeHexChange = (e) => {
        const raw = typeof e.target.value === 'string' ? e.target.value : '';
        const cleaned = raw.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
        const next = `#${cleaned}`;
        setThemeHex(next);
        if (cleaned.length === 6) {
            setThemeColor(next);
        }
    };

    const publicPageRoot = useMemo(() => {
        const raw = typeof appUrl === 'string' ? appUrl : '';
        return raw ? raw.replace(/\/$/, '') : '';
    }, [appUrl]);

    const previewUrl = useMemo(() => {
        const slug = publicForm.data.slug;
        if (!slug) return null;
        return publicPageRoot ? `${publicPageRoot}/p/${slug}` : `/p/${slug}`;
    }, [publicForm.data.slug, publicPageRoot]);

    const slugHelperText = useMemo(() => {
        if (publicForm.errors.slug) return publicForm.errors.slug;
        return publicPageRoot ? `Public URL will be ${publicPageRoot}/p/{slug}` : 'Public URL will be /p/{slug}';
    }, [publicForm.errors.slug, publicPageRoot]);

    const addKpi = () => {
        const next = [...(publicForm.data.kpis || []), { label: '', value: '' }];
        publicForm.setData('kpis', next);
    };

    const updateKpi = (idx, key, value) => {
        const next = [...(publicForm.data.kpis || [])];
        next[idx] = { ...(next[idx] || {}), [key]: value };
        publicForm.setData('kpis', next);
    };

    const removeKpi = (idx) => {
        publicForm.setData(
            'kpis',
            (publicForm.data.kpis || []).filter((_, i) => i !== idx),
        );
    };

    const addService = () => {
        const next = [...(publicForm.data.services || []), { title: '', description: '' }];
        publicForm.setData('services', next);
    };

    const updateService = (idx, key, value) => {
        const next = [...(publicForm.data.services || [])];
        next[idx] = { ...(next[idx] || {}), [key]: value };
        publicForm.setData('services', next);
    };

    const removeService = (idx) => {
        publicForm.setData(
            'services',
            (publicForm.data.services || []).filter((_, i) => i !== idx),
        );
    };

    const addFaq = () => {
        const next = [...(publicForm.data.faqs || []), { q: '', a: '' }];
        publicForm.setData('faqs', next);
    };

    const updateFaq = (idx, key, value) => {
        const next = [...(publicForm.data.faqs || [])];
        next[idx] = { ...(next[idx] || {}), [key]: value };
        publicForm.setData('faqs', next);
    };

    const removeFaq = (idx) => {
        publicForm.setData(
            'faqs',
            (publicForm.data.faqs || []).filter((_, i) => i !== idx),
        );
    };

    const removeGalleryAt = (idx) => {
        const url = publicForm.data.gallery?.[idx]?.url;
        if (url) {
            setRemovedGalleryUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
        }
        publicForm.setData(
            'gallery',
            (publicForm.data.gallery || []).filter((_, i) => i !== idx),
        );
    };

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
            { key: 'voucher_print', label: 'Voucher Print', icon: <VoucherIcon fontSize="small" /> },
        ];
    }, []);

    const submit = (e) => {
        e.preventDefault();
        form.patch(`${adminAppUrl}/system/organization-settings`, { preserveScroll: true });
    };

    const submitPublic = (e) => {
        e.preventDefault();
        publicForm.patch(`${adminAppUrl}/system/public-page`, {
            preserveScroll: true,
            onSuccess: () => {
                setRemovedGalleryUrls([]);
            },
        });
    };

    const submitVoucherPrint = (e) => {
        e.preventDefault();
        voucherPrintForm.patch(`${adminAppUrl}/system/organization-settings/voucher-print-template`, { preserveScroll: true });
    };

    useEffect(() => {
        const serverGallery = coerceArray(publicPage?.gallery);
        if (!serverGallery.length) return;

        const removedSet = new Set(removedGalleryUrls);
        const current = Array.isArray(publicForm.data.gallery) ? publicForm.data.gallery : [];
        const currentUrls = new Set(current.map((x) => x?.url).filter(Boolean));

        const merged = [...current];
        for (const item of serverGallery) {
            const url = item?.url;
            if (!url) continue;
            if (removedSet.has(url)) continue;
            if (currentUrls.has(url)) continue;
            merged.push(item);
        }

        const next = merged.filter((x) => x?.url && !removedSet.has(x.url));
        if (next.length !== current.length) {
            publicForm.setData('gallery', next);
        }
    }, [publicPage?.gallery]);

    const handleTabChange = (nextTab) => {
        setActiveTab(nextTab);
        updateUrlTab(nextTab);
    };

    const openVoucherPrintLogoPicker = () => {
        setCropMode('voucher_logo');
        if (voucherPrintLogoFileInputRef.current) {
            voucherPrintLogoFileInputRef.current.click();
        }
    };

    const openLogoPicker = () => {
        setCropMode('logo');
        if (logoFileInputRef.current) {
            logoFileInputRef.current.click();
        }
    };

    const openCoverPicker = () => {
        setCropMode('cover');
        if (coverFileInputRef.current) {
            coverFileInputRef.current.click();
        }
    };

    const openGalleryPicker = () => {
        setCropMode('gallery');
        if (galleryFileInputRef.current) {
            galleryFileInputRef.current.click();
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
        logoUploadForm.reset();
        voucherPrintLogoUploadForm.reset();
        coverUploadForm.reset();
        galleryUploadForm.reset();
        if (logoFileInputRef.current) {
            logoFileInputRef.current.value = '';
        }
        if (voucherPrintLogoFileInputRef.current) {
            voucherPrintLogoFileInputRef.current.value = '';
        }
        if (coverFileInputRef.current) {
            coverFileInputRef.current.value = '';
        }
        if (galleryFileInputRef.current) {
            galleryFileInputRef.current.value = '';
        }
    };

    const loadImage = (file, mode) => {
        cleanupImageUrl();
        setCropMode(mode);
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

    const onLogoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file, 'logo');
    };

    const onVoucherPrintLogoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file, 'voucher_logo');
    };

    const onCoverFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file, 'cover');
    };

    const onGalleryFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file, 'gallery');
    };

    const cropConfig = useMemo(() => {
        if (cropMode === 'cover') {
            return {
                title: 'Crop cover (16:9)',
                previewW: 320,
                previewH: 180,
                outW: 1600,
                outH: 900,
                saveLabel: 'Save cover',
            };
        }

        if (cropMode === 'gallery') {
            return {
                title: 'Crop gallery photo (4:3)',
                previewW: 320,
                previewH: 240,
                outW: 1200,
                outH: 900,
                saveLabel: 'Add photo',
            };
        }

        if (cropMode === 'voucher_logo') {
            return {
                title: 'Crop voucher logo (1:1)',
                previewW: 240,
                previewH: 240,
                outW: 512,
                outH: 512,
                saveLabel: 'Save voucher logo',
            };
        }

        return {
            title: 'Crop logo (1:1)',
            previewW: 240,
            previewH: 240,
            outW: 512,
            outH: 512,
            saveLabel: 'Save logo',
        };
    }, [cropMode]);

    const clampOffset = (x, y, imgW, imgH, scale, cropW, cropH) => {
        const sw = imgW * scale;
        const sh = imgH * scale;
        const maxX = Math.max(0, (sw - cropW) / 2);
        const maxY = Math.max(0, (sh - cropH) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const baseScale = Math.max(cw / imgW, ch / imgH);
        const scale = baseScale * zoom;
        const clamped = clampOffset(offset.x, offset.y, imgW, imgH, scale, cw, ch);
        if (clamped.x !== offset.x || clamped.y !== offset.y) {
            setOffset(clamped);
            return;
        }

        const sw = imgW * scale;
        const sh = imgH * scale;
        const dx = (cw - sw) / 2 + clamped.x;
        const dy = (ch - sh) / 2 + clamped.y;

        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, sw, sh);
    }, [img, zoom, offset]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        if (!cropOpen) return;
        const id = window.requestAnimationFrame(() => {
            draw();
        });
        return () => window.cancelAnimationFrame(id);
    }, [cropOpen, cropMode, cropConfig.previewW, cropConfig.previewH, draw]);

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

    const uploadCroppedImage = () => {
        if (!img) return;

        const previewW = cropConfig.previewW;
        const previewH = cropConfig.previewH;
        const outW = cropConfig.outW;
        const outH = cropConfig.outH;

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        const baseScalePreview = Math.max(previewW / imgW, previewH / imgH);
        const scalePreview = baseScalePreview * zoom;
        const clampedPreview = clampOffset(offset.x, offset.y, imgW, imgH, scalePreview, previewW, previewH);

        const baseScaleOut = Math.max(outW / imgW, outH / imgH);
        const scaleOut = baseScaleOut * zoom;
        const scaledOffset = {
            x: clampedPreview.x * (outW / previewW),
            y: clampedPreview.y * (outH / previewH),
        };
        const clampedOut = clampOffset(scaledOffset.x, scaledOffset.y, imgW, imgH, scaleOut, outW, outH);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const ctx = outCanvas.getContext('2d');

        const sw = imgW * scaleOut;
        const sh = imgH * scaleOut;
        const dx = (outW - sw) / 2 + clampedOut.x;
        const dy = (outH - sh) / 2 + clampedOut.y;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, dx, dy, sw, sh);

        outCanvas.toBlob(
            (blob) => {
                if (!blob) return;
                const fileName =
                    cropMode === 'cover' ? 'cover.jpg' : cropMode === 'gallery' ? 'photo.jpg' : cropMode === 'voucher_logo' ? 'voucher_logo.png' : 'logo.png';
                const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

                if (cropMode === 'cover') {
                    coverUploadForm.clearErrors();
                    coverUploadForm.transform(() => ({ cover: file }));
                    coverUploadForm.post(`${adminAppUrl}/system/organization-settings/cover`, {
                        forceFormData: true,
                        preserveScroll: true,
                        preserveState: false,
                        onSuccess: () => {
                            closeCropper();
                        },
                        onFinish: () => {
                            coverUploadForm.transform((data) => data);
                        },
                    });
                    return;
                }

                if (cropMode === 'gallery') {
                    galleryUploadForm.clearErrors();
                    galleryUploadForm.transform(() => ({ photo: file }));
                    galleryUploadForm.post(`${adminAppUrl}/system/organization-settings/gallery`, {
                        forceFormData: true,
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: (page) => {
                            const next = coerceArray(page?.props?.publicPage?.gallery);
                            publicForm.setData('gallery', next);
                            setRemovedGalleryUrls([]);
                            closeCropper();
                        },
                        onFinish: () => {
                            galleryUploadForm.transform((data) => data);
                        },
                    });
                    return;
                }

                if (cropMode === 'voucher_logo') {
                    voucherPrintLogoUploadForm.clearErrors();
                    voucherPrintLogoUploadForm.transform(() => ({ logo: file }));
                    voucherPrintLogoUploadForm.post(`${adminAppUrl}/system/organization-settings/voucher-print-logo`, {
                        forceFormData: true,
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: (page) => {
                            const nextLogo = page?.props?.voucherPrintTemplate?.logo_url;
                            if (nextLogo) {
                                voucherPrintForm.setData('logo_url', nextLogo);
                                voucherPrintForm.setData('show_logo', true);
                            }
                            closeCropper();
                        },
                        onFinish: () => {
                            voucherPrintLogoUploadForm.transform((data) => data);
                        },
                    });
                    return;
                }

                logoUploadForm.clearErrors();
                logoUploadForm.transform(() => ({ logo: file }));
                logoUploadForm.post(`${adminAppUrl}/system/organization-settings/logo`, {
                    forceFormData: true,
                    preserveScroll: true,
                    preserveState: false,
                    onSuccess: () => {
                        closeCropper();
                    },
                    onFinish: () => {
                        logoUploadForm.transform((data) => data);
                    },
                });
            },
            cropMode === 'logo' || cropMode === 'voucher_logo' ? 'image/png' : 'image/jpeg',
            cropMode === 'logo' || cropMode === 'voucher_logo' ? 0.92 : 0.9,
        );
    };

    const cropUploading =
        cropMode === 'cover'
            ? coverUploadForm.processing
            : cropMode === 'gallery'
              ? galleryUploadForm.processing
              : cropMode === 'voucher_logo'
                ? voucherPrintLogoUploadForm.processing
                : logoUploadForm.processing;

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
                                            if (isWorkspaceOverlay) {
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
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
                        >
                            Open public page
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
                    display: { xs: 'block', md: 'flex' },
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
                                {isWorkspaceOverlay && (
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
                                ) : activeTab === 'public' ? (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disabled={publicForm.processing}
                                        onClick={(e) => submitPublic(e)}
                                        startIcon={publicForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                    >
                                        Save
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        disabled={voucherPrintForm.processing}
                                        onClick={(e) => submitVoucherPrint(e)}
                                        startIcon={voucherPrintForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
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
                                                    ref={logoFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={onLogoFileChange}
                                                />
                                                <IconButton
                                                    onClick={openLogoPicker}
                                                    disabled={logoUploadForm.processing}
                                                    sx={{
                                                        width: 88,
                                                        height: 88,
                                                        borderRadius: 3,
                                                        border: '1px dashed',
                                                        borderColor: 'divider',
                                                        bgcolor: 'rgba(15,23,42,0.02)',
                                                        overflow: 'hidden',
                                                        p: 0,
                                                        '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59,130,246,0.06)' },
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
                                                </IconButton>

                                                <Stack spacing={1}>
                                                    <Divider />
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                                        Theme color
                                                    </Typography>
                                                    <Paper variant="outlined" sx={{ borderRadius: 2.5, p: 1.25 }}>
                                                        <Stack
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1.25}
                                                            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                        >
                                                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                                                                <Box
                                                                    sx={{
                                                                        width: 28,
                                                                        height: 28,
                                                                        borderRadius: 2,
                                                                        bgcolor: form.data.theme_color,
                                                                        border: '1px solid',
                                                                        borderColor: 'divider',
                                                                    }}
                                                                />
                                                                <Box sx={{ minWidth: 0 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                                        Accent preview
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                        Used for buttons and highlights on your public page.
                                                                    </Typography>
                                                                </Box>
                                                            </Stack>
                                                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                                                <Button
                                                                    variant="text"
                                                                    onClick={() => setThemeColor(defaultThemeColor)}
                                                                    disabled={form.processing}
                                                                >
                                                                    Reset
                                                                </Button>
                                                            </Stack>
                                                        </Stack>
                                                    </Paper>

                                                    <Box
                                                        sx={{
                                                            display: 'grid',
                                                            gap: 1,
                                                            gridTemplateColumns: 'repeat(6, 26px)',
                                                            justifyContent: 'flex-start',
                                                            alignContent: 'flex-start',
                                                            mt: 3.25,
                                                        }}
                                                    >
                                                        {themePresets.map((c) => {
                                                            const selected = (form.data.theme_color || '').toUpperCase() === c;
                                                            return (
                                                                <Box
                                                                    key={c}
                                                                    component="button"
                                                                    type="button"
                                                                    onClick={() => setThemeColor(c)}
                                                                    aria-label={`Set theme color to ${c}`}
                                                                    disabled={form.processing}
                                                                    sx={{
                                                                        appearance: 'none',
                                                                        width: 26,
                                                                        height: 26,
                                                                        borderRadius: 999,
                                                                        backgroundColor: c,
                                                                        border: '2px solid',
                                                                        borderColor: selected ? 'primary.main' : 'divider',
                                                                        cursor: form.processing ? 'not-allowed' : 'pointer',
                                                                        transition: 'transform 120ms ease, border-color 120ms ease',
                                                                        '&:hover': { transform: form.processing ? 'none' : 'translateY(-1px)' },
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </Box>

                                                    <Grid container spacing={1.25} sx={{ mt: 0.75 }}>
                                                        <Grid size={{ xs: 12, sm: 6 }}>
                                                            <TextField
                                                                label="Color"
                                                                type="color"
                                                                fullWidth
                                                                value={form.data.theme_color}
                                                                onChange={(e) => setThemeColor(e.target.value)}
                                                                InputLabelProps={{ shrink: true }}
                                                                sx={{
                                                                    '& input[type="color"]': {
                                                                        height: 42,
                                                                        padding: 0,
                                                                        cursor: 'pointer',
                                                                        borderRadius: '10px',
                                                                        overflow: 'hidden',
                                                                    },
                                                                    '& input[type="color"]::-webkit-color-swatch-wrapper': { padding: 0 },
                                                                    '& input[type="color"]::-webkit-color-swatch': { border: 'none', borderRadius: '10px' },
                                                                    '& input[type="color"]::-moz-color-swatch': { border: 'none', borderRadius: '10px' },
                                                                }}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, sm: 6 }}>
                                                            <TextField
                                                                label="Hex"
                                                                fullWidth
                                                                value={themeHex}
                                                                onChange={onThemeHexChange}
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
                        ) : activeTab === 'public' ? (
                            <Box component="form" onSubmit={submitPublic} noValidate>
                                <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Stack spacing={1.5}>
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
                                                        helperText={slugHelperText}
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

                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Stack
                                                        direction={{ xs: 'column', sm: 'row' }}
                                                        spacing={1.25}
                                                        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                    >
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                            Highlights
                                                        </Typography>
                                                        <Button
                                                            variant="outlined"
                                                            onClick={addKpi}
                                                            disabled={publicForm.processing}
                                                            sx={{ borderRadius: 2, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                                                            fullWidth={isSmallScreen}
                                                        >
                                                            Add
                                                        </Button>
                                                    </Stack>
                                                    {(publicForm.data.kpis || []).length ? (
                                                        <Stack spacing={1.25}>
                                                            {(publicForm.data.kpis || []).map((kpi, idx) => (
                                                                <Stack
                                                                    key={idx}
                                                                    direction={{ xs: 'column', sm: 'row' }}
                                                                    spacing={1}
                                                                    sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
                                                                >
                                                                    <TextField
                                                                        label="Label"
                                                                        value={kpi?.label ?? ''}
                                                                        onChange={(e) => updateKpi(idx, 'label', e.target.value)}
                                                                        sx={{ flex: 1 }}
                                                                    />
                                                                    <TextField
                                                                        label="Value"
                                                                        value={kpi?.value ?? ''}
                                                                        onChange={(e) => updateKpi(idx, 'value', e.target.value)}
                                                                        sx={{ width: { xs: '100%', sm: 160 } }}
                                                                    />
                                                                    <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', sm: 'flex-start' } }}>
                                                                        <IconButton
                                                                            onClick={() => removeKpi(idx)}
                                                                            disabled={publicForm.processing}
                                                                            size="small"
                                                                        >
                                                                            <CloseIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Box>
                                                                </Stack>
                                                            ))}
                                                        </Stack>
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Add a few metrics like years, cities covered, on-time rate.
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </SettingsCard>

                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Stack
                                                        direction={{ xs: 'column', sm: 'row' }}
                                                        spacing={1.25}
                                                        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                    >
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                            Services
                                                        </Typography>
                                                        <Button
                                                            variant="outlined"
                                                            onClick={addService}
                                                            disabled={publicForm.processing}
                                                            sx={{ borderRadius: 2, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                                                            fullWidth={isSmallScreen}
                                                        >
                                                            Add
                                                        </Button>
                                                    </Stack>
                                                    {(publicForm.data.services || []).length ? (
                                                        <Stack spacing={1.5}>
                                                            {(publicForm.data.services || []).map((svc, idx) => (
                                                                <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                                    <Stack spacing={1.25}>
                                                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                                            <TextField
                                                                                label="Title"
                                                                                value={svc?.title ?? ''}
                                                                                onChange={(e) => updateService(idx, 'title', e.target.value)}
                                                                                sx={{ flex: 1 }}
                                                                            />
                                                                            <IconButton
                                                                                onClick={() => removeService(idx)}
                                                                                disabled={publicForm.processing}
                                                                                size="small"
                                                                            >
                                                                                <CloseIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Stack>
                                                                        <TextField
                                                                            label="Description"
                                                                            multiline
                                                                            minRows={2}
                                                                            value={svc?.description ?? ''}
                                                                            onChange={(e) => updateService(idx, 'description', e.target.value)}
                                                                        />
                                                                    </Stack>
                                                                </Paper>
                                                            ))}
                                                        </Stack>
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Add 3–6 short services to showcase your work.
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </SettingsCard>

                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Stack
                                                        direction={{ xs: 'column', sm: 'row' }}
                                                        spacing={1.25}
                                                        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                    >
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                            FAQ
                                                        </Typography>
                                                        <Button
                                                            variant="outlined"
                                                            onClick={addFaq}
                                                            disabled={publicForm.processing}
                                                            sx={{ borderRadius: 2, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                                                            fullWidth={isSmallScreen}
                                                        >
                                                            Add
                                                        </Button>
                                                    </Stack>
                                                    {(publicForm.data.faqs || []).length ? (
                                                        <Stack spacing={1.5}>
                                                            {(publicForm.data.faqs || []).map((faq, idx) => (
                                                                <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                                    <Stack spacing={1.25}>
                                                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                                            <TextField
                                                                                label="Question"
                                                                                value={faq?.q ?? ''}
                                                                                onChange={(e) => updateFaq(idx, 'q', e.target.value)}
                                                                                sx={{ flex: 1 }}
                                                                            />
                                                                            <IconButton onClick={() => removeFaq(idx)} disabled={publicForm.processing} size="small">
                                                                                <CloseIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Stack>
                                                                        <TextField
                                                                            label="Answer"
                                                                            multiline
                                                                            minRows={2}
                                                                            value={faq?.a ?? ''}
                                                                            onChange={(e) => updateFaq(idx, 'a', e.target.value)}
                                                                        />
                                                                    </Stack>
                                                                </Paper>
                                                            ))}
                                                        </Stack>
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Add common questions and answers (5–8 is good).
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </SettingsCard>
                                        </Stack>
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
                                                        Cover image
                                                    </Typography>
                                                    <input
                                                        ref={coverFileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={onCoverFileChange}
                                                    />
                                                    <Stack spacing={1.25}>
                                                        <Box
                                                            sx={{
                                                                width: '100%',
                                                                aspectRatio: '16 / 9',
                                                                borderRadius: 2,
                                                                border: '1px dashed',
                                                                borderColor: 'divider',
                                                                bgcolor: 'rgba(15,23,42,0.02)',
                                                                overflow: 'hidden',
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                            }}
                                                        >
                                                            {publicPage?.cover_url ? (
                                                                <Box
                                                                    component="img"
                                                                    src={publicPage.cover_url}
                                                                    alt="Cover"
                                                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    No cover uploaded
                                                                </Typography>
                                                            )}
                                                        </Box>

                                                        <Stack
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1.25}
                                                            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                        >
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                    Upload cover
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                    Upload and crop 16:9
                                                                </Typography>
                                                                {coverUploadForm.errors.cover ? (
                                                                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                                        {coverUploadForm.errors.cover}
                                                                    </Typography>
                                                                ) : null}
                                                            </Box>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={openCoverPicker}
                                                                disabled={coverUploadForm.processing}
                                                                startIcon={<UploadIcon fontSize="small" />}
                                                                sx={{ borderRadius: 2, flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                                                                fullWidth={isSmallScreen}
                                                            >
                                                                Upload
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                </Stack>
                                            </SettingsCard>
                                            <SettingsCard>
                                                <Stack spacing={1.5}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        Gallery
                                                    </Typography>
                                                    <input
                                                        ref={galleryFileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={onGalleryFileChange}
                                                    />
                                                    <Stack spacing={1.25}>
                                                        <Stack
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1.25}
                                                            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                                                        >
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                    Add photos
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                    Upload and crop 4:3
                                                                </Typography>
                                                                {galleryUploadForm.errors.photo ? (
                                                                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                                        {galleryUploadForm.errors.photo}
                                                                    </Typography>
                                                                ) : null}
                                                            </Box>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={openGalleryPicker}
                                                                disabled={galleryUploadForm.processing}
                                                                startIcon={<UploadIcon fontSize="small" />}
                                                                sx={{ borderRadius: 2, flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                                                                fullWidth={isSmallScreen}
                                                            >
                                                                Add
                                                            </Button>
                                                        </Stack>

                                                        {(publicForm.data.gallery || []).length ? (
                                                            <Box
                                                                sx={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                                                                    gap: 1,
                                                                }}
                                                            >
                                                                {(publicForm.data.gallery || []).map((item, idx) => (
                                                                    <Box
                                                                        key={idx}
                                                                        sx={{
                                                                            position: 'relative',
                                                                            borderRadius: 2,
                                                                            overflow: 'hidden',
                                                                            aspectRatio: '4 / 3',
                                                                            border: '1px solid',
                                                                            borderColor: 'divider',
                                                                            bgcolor: 'grey.100',
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            component="img"
                                                                            src={item?.url}
                                                                            alt={`Gallery ${idx + 1}`}
                                                                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                                        />
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => removeGalleryAt(idx)}
                                                                            disabled={publicForm.processing}
                                                                            sx={{
                                                                                position: 'absolute',
                                                                                top: 6,
                                                                                right: 6,
                                                                                bgcolor: 'rgba(0,0,0,0.35)',
                                                                                color: '#fff',
                                                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.45)' },
                                                                            }}
                                                                        >
                                                                            <CloseIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Box>
                                                                ))}
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                No photos yet.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Stack>
                                            </SettingsCard>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Box>
                        ) : (
                            <Box component="form" onSubmit={submitVoucherPrint} noValidate>
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
                                                        <VoucherIcon fontSize="small" />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                                            Voucher Print Template
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Customize the printed voucher frame.
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                <Divider />
                                                <TextField
                                                    select
                                                    label="Paper size"
                                                    value={voucherPrintForm.data.paper_size}
                                                    onChange={(e) => voucherPrintForm.setData('paper_size', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.paper_size)}
                                                    helperText={voucherPrintForm.errors.paper_size || 'A4 for office printer, Receipt 80mm for thermal printer.'}
                                                >
                                                    <MenuItem value="A4">A4</MenuItem>
                                                    <MenuItem value="RECEIPT_80">Receipt 80mm</MenuItem>
                                                </TextField>

                                                <TextField
                                                    required
                                                    label="Header title"
                                                    value={voucherPrintForm.data.header_title}
                                                    onChange={(e) => voucherPrintForm.setData('header_title', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.header_title)}
                                                    helperText={voucherPrintForm.errors.header_title || 'Example: Warehouse & Transport'}
                                                />
                                                <TextField
                                                    label="Header subtitle"
                                                    value={voucherPrintForm.data.header_subtitle}
                                                    onChange={(e) => voucherPrintForm.setData('header_subtitle', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.header_subtitle)}
                                                    helperText={voucherPrintForm.errors.header_subtitle || 'Example: Voucher'}
                                                />

                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={voucherPrintForm.data.show_logo}
                                                            onChange={(e) => voucherPrintForm.setData('show_logo', e.target.checked)}
                                                        />
                                                    }
                                                    label="Show logo"
                                                />
                                                <input
                                                    ref={voucherPrintLogoFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={onVoucherPrintLogoFileChange}
                                                />
                                                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                    <IconButton
                                                        onClick={openVoucherPrintLogoPicker}
                                                        disabled={voucherPrintLogoUploadForm.processing}
                                                        sx={{
                                                            width: 72,
                                                            height: 72,
                                                            borderRadius: 2.5,
                                                            border: '1px dashed',
                                                            borderColor: 'divider',
                                                            bgcolor: 'rgba(15,23,42,0.02)',
                                                            overflow: 'hidden',
                                                            p: 0,
                                                            flexShrink: 0,
                                                            '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59,130,246,0.06)' },
                                                        }}
                                                    >
                                                        {(safeStr(voucherPrintForm.data.logo_url) || safeStr(publicPage?.logo_url)) ? (
                                                            <Box
                                                                component="img"
                                                                src={safeStr(voucherPrintForm.data.logo_url) || safeStr(publicPage?.logo_url)}
                                                                alt="Voucher logo"
                                                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <VoucherIcon sx={{ color: 'text.disabled' }} />
                                                        )}
                                                    </IconButton>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                            Upload voucher logo
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                            Upload and crop 1:1
                                                        </Typography>
                                                        {voucherPrintLogoUploadForm.errors.logo ? (
                                                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                                {voucherPrintLogoUploadForm.errors.logo}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                </Stack>
                                                <TextField
                                                    label="Logo URL"
                                                    value={voucherPrintForm.data.logo_url}
                                                    onChange={(e) => voucherPrintForm.setData('logo_url', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.logo_url)}
                                                    helperText={voucherPrintForm.errors.logo_url || 'Leave blank to use public page logo (if available).'}
                                                />

                                                <Divider />

                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={voucherPrintForm.data.show_contact}
                                                            onChange={(e) => voucherPrintForm.setData('show_contact', e.target.checked)}
                                                        />
                                                    }
                                                    label="Show contact"
                                                />
                                                <Grid container spacing={1.5}>
                                                    <Grid size={{ xs: 12, sm: 6 }}>
                                                        <TextField
                                                            label="Phone"
                                                            value={voucherPrintForm.data.contact_phone}
                                                            onChange={(e) => voucherPrintForm.setData('contact_phone', e.target.value)}
                                                            error={Boolean(voucherPrintForm.errors.contact_phone)}
                                                        />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, sm: 6 }}>
                                                        <TextField
                                                            label="Email"
                                                            value={voucherPrintForm.data.contact_email}
                                                            onChange={(e) => voucherPrintForm.setData('contact_email', e.target.value)}
                                                            error={Boolean(voucherPrintForm.errors.contact_email)}
                                                        />
                                                    </Grid>
                                                    <Grid size={{ xs: 12 }}>
                                                        <TextField
                                                            label="Address"
                                                            value={voucherPrintForm.data.contact_address}
                                                            onChange={(e) => voucherPrintForm.setData('contact_address', e.target.value)}
                                                            error={Boolean(voucherPrintForm.errors.contact_address)}
                                                            multiline
                                                            minRows={2}
                                                        />
                                                    </Grid>
                                                </Grid>

                                                <Divider />

                                                <TextField
                                                    label="Footer note"
                                                    value={voucherPrintForm.data.footer_note}
                                                    onChange={(e) => voucherPrintForm.setData('footer_note', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.footer_note)}
                                                    helperText={voucherPrintForm.errors.footer_note || 'Optional'}
                                                />

                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={voucherPrintForm.data.show_payment_status}
                                                                onChange={(e) => voucherPrintForm.setData('show_payment_status', e.target.checked)}
                                                            />
                                                        }
                                                        label="Show payment status"
                                                    />
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={voucherPrintForm.data.show_signature_boxes}
                                                                onChange={(e) => voucherPrintForm.setData('show_signature_boxes', e.target.checked)}
                                                            />
                                                        }
                                                        label="Show signature boxes"
                                                    />
                                                </Stack>
                                            </Stack>
                                        </SettingsCard>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <SettingsCard>
                                            <Stack spacing={1.5}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                    Preview
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Updates instantly as you change the fields.
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        bgcolor: 'grey.50',
                                                        borderRadius: 2,
                                                        p: voucherPrintForm.data.paper_size === 'RECEIPT_80' ? 0.75 : 1.25,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        overflowX: 'auto',
                                                    }}
                                                >
                                                    <VoucherPrintLivePreview voucher={voucherPrintPreviewVoucher} template={voucherPrintPreviewTemplate} />
                                                </Box>
                                            </Stack>
                                        </SettingsCard>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}
                    </Stack>
                </Box>

                {isWorkspacePinned && (
                    <Paper
                        sx={{
                            width: 208,
                            borderRadius: 0,
                            position: 'sticky',
                            top: 72,
                            height: 'calc(100vh - 72px)',
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            overflowY: 'auto',
                        }}
                    >
                        {SidebarContent}
                    </Paper>
                )}
            </Box>

            <Drawer
                anchor="right"
                open={isWorkspaceOverlay && sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 208,
                        boxSizing: 'border-box',
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        overflowY: 'auto',
                    },
                }}
            >
                <Box sx={{ minHeight: 48 }} />
                {SidebarContent}
            </Drawer>

            <Dialog
                open={cropOpen}
                onClose={() => !cropUploading && closeCropper()}
                fullWidth
                maxWidth={cropMode === 'cover' || cropMode === 'gallery' ? 'sm' : 'xs'}
                TransitionProps={{
                    onEntered: () => {
                        window.requestAnimationFrame(() => {
                            draw();
                        });
                    },
                }}
            >
                <DialogTitle>{cropConfig.title}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Box
                            sx={{
                                width: '100%',
                                maxWidth: cropConfig.previewW,
                                aspectRatio: `${cropConfig.previewW} / ${cropConfig.previewH}`,
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
                                width={cropConfig.previewW}
                                height={cropConfig.previewH}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'block',
                                    cursor: img ? 'grab' : 'default',
                                }}
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
                    <Button onClick={closeCropper} disabled={cropUploading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={uploadCroppedImage}
                        disabled={!img || cropUploading}
                    >
                        {cropConfig.saveLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
