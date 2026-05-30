import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    ReceiptLong as VoucherIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const sectionCardSx = {
    p: { xs: 1.75, sm: 2 },
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

function n2(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function safeStr(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function fmtQty(value) {
    const n = n2(value);
    if (n == null) return '-';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
}

function fmtMoney(value) {
    const n = n2(value);
    if (n == null) return '-';
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
        for (const item of items) {
            const n = n2(item?.freight_amount);
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

    const fromWarehouseName = voucher?.source_warehouse?.display_name || voucher?.source_warehouse?.city || '-';
    const toWarehouseName = voucher?.default_to_warehouse?.display_name || voucher?.default_to_warehouse?.city || '-';

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
                                        {voucher?.voucher_no || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                        {voucher?.voucher_date || '-'}
                                    </Typography>
                                </Box>
                            </Stack>

                            {showContact && (contactPhone || contactEmail || contactAddress) ? (
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {[contactPhone ? `Phone: ${contactPhone}` : null, contactEmail ? `Email: ${contactEmail}` : null, contactAddress || null]
                                        .filter(Boolean)
                                        .join(' � ')}
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
                                    {voucher?.default_recipient_name || '-'}
                                </Typography>

                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    Recipient phone
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                    {voucher?.default_recipient_phone || '-'}
                                </Typography>

                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    Destination address
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                    {voucher?.default_to_address_line1 || '-'}
                                </Typography>

                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    Remark
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                    {voucher?.default_destination_remark || '-'}
                                </Typography>

                                {showPaymentStatus ? (
                                    <>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            Payment status
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                            {voucher?.payment_status || '-'}
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
                                    {(isReceipt ? ['No', 'Item', 'Qty'] : ['No', 'Item', 'Qty', 'Fragile']).map((header) => (
                                        <Typography key={header} variant="caption" sx={{ fontWeight: 900 }}>
                                            {header}
                                        </Typography>
                                    ))}
                                </Box>
                                {(voucher?.items || []).map((item, idx) => (
                                    <Box
                                        key={item?.id || idx}
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
                                                {item?.product?.name || '-'}
                                            </Typography>
                                            {item?.description ? (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                                                    {item.description}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                        <Typography variant="caption" sx={{ textAlign: 'right' }}>
                                            {fmtQty(item?.qty)}
                                        </Typography>
                                        {isReceipt ? null : <Typography variant="caption">{item?.is_fragile ? 'Yes' : 'No'}</Typography>}
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
    const pageProps = usePage().props;
    const adminAppUrl = pageProps.admin_app_url;
    const organization = pageProps.organization;
    const voucherPrintTemplate = pageProps.voucherPrintTemplate;
    const flash = pageProps.flash ?? {};

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

    const voucherPrintLogoUploadForm = useForm({ logo: null });
    const voucherPrintLogoFileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

    const [cropOpen, setCropOpen] = useState(false);
    const [img, setImg] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

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
            items: [
                { id: 1, qty: 10, is_fragile: false, description: 'Sample note', product: { name: 'Carton Box' }, freight_amount: 15000 },
                { id: 2, qty: 2.5, is_fragile: true, description: null, product: { name: 'Glass Item' }, freight_amount: 5000 },
                { id: 3, qty: 1, is_fragile: false, description: null, product: { name: 'Spare Parts' }, freight_amount: 2500 },
            ],
            payments: [{ amount: 10000 }],
        };
    }, []);

    const voucherPrintPreviewTemplate = useMemo(
        () => ({
            paper_size: voucherPrintForm.data.paper_size,
            header_title: voucherPrintForm.data.header_title,
            header_subtitle: voucherPrintForm.data.header_subtitle,
            show_logo: voucherPrintForm.data.show_logo,
            logo_url: safeStr(voucherPrintForm.data.logo_url),
            show_contact: voucherPrintForm.data.show_contact,
            contact_phone: voucherPrintForm.data.contact_phone,
            contact_email: voucherPrintForm.data.contact_email,
            contact_address: voucherPrintForm.data.contact_address,
            footer_note: voucherPrintForm.data.footer_note,
            show_payment_status: voucherPrintForm.data.show_payment_status,
            show_signature_boxes: voucherPrintForm.data.show_signature_boxes,
        }),
        [voucherPrintForm.data],
    );

    const submitVoucherPrint = (e) => {
        e.preventDefault();
        voucherPrintForm.patch(`${adminAppUrl}/system/organization-settings/voucher-print-template`, { preserveScroll: true });
    };

    const openVoucherPrintLogoPicker = () => {
        if (voucherPrintLogoFileInputRef.current) {
            voucherPrintLogoFileInputRef.current.click();
        }
    };

    const cleanupImageUrl = useCallback(() => {
        if (imgUrl) {
            URL.revokeObjectURL(imgUrl);
        }
    }, [imgUrl]);

    const closeCropper = useCallback(() => {
        cleanupImageUrl();
        setImgUrl(null);
        setImg(null);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setCropOpen(false);
        voucherPrintLogoUploadForm.reset();
        if (voucherPrintLogoFileInputRef.current) {
            voucherPrintLogoFileInputRef.current.value = '';
        }
    }, [cleanupImageUrl, voucherPrintLogoUploadForm]);

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

    const onVoucherPrintLogoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadImage(file);
    };

    const clampOffset = (x, y, imgW, imgH, scale, cropW, cropH) => {
        const scaledWidth = imgW * scale;
        const scaledHeight = imgH * scale;
        const maxX = Math.max(0, (scaledWidth - cropW) / 2);
        const maxY = Math.max(0, (scaledHeight - cropH) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const cropWidth = canvas.width;
        const cropHeight = canvas.height;
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;
        const baseScale = Math.max(cropWidth / imgWidth, cropHeight / imgHeight);
        const scale = baseScale * zoom;
        const clamped = clampOffset(offset.x, offset.y, imgWidth, imgHeight, scale, cropWidth, cropHeight);
        if (clamped.x !== offset.x || clamped.y !== offset.y) {
            setOffset(clamped);
            return;
        }

        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const drawX = (cropWidth - scaledWidth) / 2 + clamped.x;
        const drawY = (cropHeight - scaledHeight) / 2 + clamped.y;

        ctx.clearRect(0, 0, cropWidth, cropHeight);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cropWidth, cropHeight);
        ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
    }, [img, offset, zoom]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        if (!cropOpen) return;
        const id = window.requestAnimationFrame(() => {
            draw();
        });
        return () => window.cancelAnimationFrame(id);
    }, [cropOpen, draw]);

    useEffect(() => () => cleanupImageUrl(), [cleanupImageUrl]);

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

        const previewSize = 240;
        const outputSize = 512;
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;

        const baseScalePreview = Math.max(previewSize / imgWidth, previewSize / imgHeight);
        const scalePreview = baseScalePreview * zoom;
        const clampedPreview = clampOffset(offset.x, offset.y, imgWidth, imgHeight, scalePreview, previewSize, previewSize);

        const baseScaleOutput = Math.max(outputSize / imgWidth, outputSize / imgHeight);
        const scaleOutput = baseScaleOutput * zoom;
        const scaledOffset = {
            x: clampedPreview.x * (outputSize / previewSize),
            y: clampedPreview.y * (outputSize / previewSize),
        };
        const clampedOutput = clampOffset(scaledOffset.x, scaledOffset.y, imgWidth, imgHeight, scaleOutput, outputSize, outputSize);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outputSize;
        outCanvas.height = outputSize;
        const ctx = outCanvas.getContext('2d');

        const scaledWidth = imgWidth * scaleOutput;
        const scaledHeight = imgHeight * scaleOutput;
        const drawX = (outputSize - scaledWidth) / 2 + clampedOutput.x;
        const drawY = (outputSize - scaledHeight) / 2 + clampedOutput.y;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, outputSize, outputSize);
        ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

        outCanvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], 'voucher_logo.png', { type: blob.type || 'image/png' });
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
            },
            'image/png',
            0.92,
        );
    };

    const cropUploading = voucherPrintLogoUploadForm.processing;

    return (
        <AdminLayout title="Settings">
            <Head title="Settings" />
            <Stack spacing={2.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    title="Voucher Print Settings"
                    subtitle={`Configure the voucher print template for ${organization?.name || 'your organization'}.`}
                    actions={
                        <Button
                            variant="contained"
                            size="small"
                            disabled={voucherPrintForm.processing}
                            onClick={submitVoucherPrint}
                            startIcon={voucherPrintForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                        >
                            Save
                        </Button>
                    }
                />

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
                                            {safeStr(voucherPrintForm.data.logo_url) ? (
                                                <Box
                                                    component="img"
                                                    src={safeStr(voucherPrintForm.data.logo_url)}
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
                                        helperText={voucherPrintForm.errors.logo_url || 'Optional'}
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
            </Stack>

            <Dialog
                open={cropOpen}
                onClose={() => !cropUploading && closeCropper()}
                fullWidth
                maxWidth="xs"
                TransitionProps={{
                    onEntered: () => {
                        window.requestAnimationFrame(() => {
                            draw();
                        });
                    },
                }}
            >
                <DialogTitle>Crop voucher logo (1:1)</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Box
                            sx={{
                                width: '100%',
                                maxWidth: 240,
                                aspectRatio: '1 / 1',
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
                    <Button variant="contained" onClick={uploadCroppedImage} disabled={!img || cropUploading}>
                        Save logo
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
