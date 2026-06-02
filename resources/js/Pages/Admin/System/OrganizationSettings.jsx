import AdminLayout from '@/Layouts/AdminLayout';
import PageHeader from '@/Components/PageHeader';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Paper,
    Slider,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import {
    ArticleOutlined as ContentIcon,
    BrandingWatermarkOutlined as BrandingIcon,
    CheckCircleOutlined as CheckIcon,
    Close as CloseIcon,
    CloudUploadOutlined as UploadIcon,
    ContactPhoneOutlined as ContactIcon,
    DescriptionOutlined as DocumentIcon,
    PrintOutlined as PrintIcon,
    ReceiptLong as VoucherIcon,
    Save as SaveIcon,
    TuneOutlined as TuneIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatPrintDate } from '@/utils/printing/dateFormat';

const sectionCardSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 3,
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

function SettingsSectionTitle({ icon, title, description }) {
    return (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Avatar
                sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2.25,
                    bgcolor: 'rgba(79,70,229,0.10)',
                    color: 'primary.main',
                }}
            >
                {icon}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.25 }}>
                    {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {description}
                </Typography>
            </Box>
        </Stack>
    );
}

function PresetOption({ active, title, description, icon, onClick }) {
    return (
        <Paper
            component="button"
            type="button"
            elevation={0}
            onClick={onClick}
            sx={{
                width: '100%',
                p: 1.5,
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 2.25,
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'divider',
                bgcolor: active ? 'rgba(79,70,229,0.06)' : 'background.paper',
                color: 'text.primary',
                transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
                boxShadow: active ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                '&:hover': {
                    borderColor: active ? 'primary.main' : 'text.disabled',
                    bgcolor: active ? 'rgba(79,70,229,0.08)' : 'action.hover',
                },
            }}
        >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                <Avatar
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        bgcolor: active ? 'primary.main' : 'action.selected',
                        color: active ? 'primary.contrastText' : 'text.secondary',
                    }}
                >
                    {icon}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            {title}
                        </Typography>
                        {active ? <CheckIcon color="primary" sx={{ fontSize: 19 }} /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.45 }}>
                        {description}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}

function PreferenceSwitch({ title, description, checked, onChange }) {
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: checked ? 'rgba(79,70,229,0.035)' : 'background.paper',
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>
                    {description}
                </Typography>
            </Box>
            <Switch checked={checked} onChange={onChange} inputProps={{ 'aria-label': title }} />
        </Stack>
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
                    <Box
                        sx={{
                            p: isReceipt ? 1.25 : 2,
                            '& .MuiTypography-caption': { fontSize: isReceipt ? '12px' : '13px', lineHeight: 1.25 },
                            '& .MuiTypography-subtitle2': { fontSize: '15px' },
                        }}
                    >
                        <Stack spacing={1}>
                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
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
                                        {formatPrintDate(voucher?.voucher_date) || '-'}
                                    </Typography>
                                </Box>
                            </Stack>

                            {showContact && (contactPhone || contactEmail || contactAddress) ? (
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {[contactPhone ? `Phone: ${contactPhone}` : null, contactEmail ? `Email: ${contactEmail}` : null, contactAddress || null]
                                        .filter(Boolean)
                                        .join(' | ')}
                                </Typography>
                            ) : null}

                            <Divider />

                            <Box sx={{ display: 'grid', gridTemplateColumns: isReceipt ? '110px 1fr' : '140px 1fr', gap: '3px 10px' }}>
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
                                        p: 0.75,
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
                                            p: 0.75,
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
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>
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
            <Head title="Voucher preset" />
            <Stack spacing={2.5}>
                {flash.success && <Alert severity="success">{flash.success}</Alert>}
                {flash.error && <Alert severity="error">{flash.error}</Alert>}

                <PageHeader
                    eyebrow="Settings / Voucher"
                    title="Voucher preset"
                    subtitle={`Set the default printed voucher style for ${organization?.name || 'your organization'}. Changes are reflected in the preview before you save.`}
                    actions={
                        <Button
                            variant="contained"
                            fullWidth
                            disabled={voucherPrintForm.processing}
                            onClick={submitVoucherPrint}
                            startIcon={voucherPrintForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                            sx={{ px: 2.25 }}
                        >
                            Save preset
                        </Button>
                    }
                >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 2.5 }}>
                        {[
                            ['1', 'Choose print format'],
                            ['2', 'Add voucher identity'],
                            ['3', 'Review live preview'],
                        ].map(([number, label]) => (
                            <Stack key={number} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                <Avatar sx={{ width: 22, height: 22, bgcolor: 'rgba(79,70,229,0.10)', color: 'primary.main', fontSize: 11, fontWeight: 900 }}>
                                    {number}
                                </Avatar>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {label}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </PageHeader>

                <Box component="form" onSubmit={submitVoucherPrint} noValidate>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <Stack spacing={2}>
                                <SettingsCard>
                                    <Stack spacing={1.75}>
                                        <SettingsSectionTitle
                                            icon={<PrintIcon fontSize="small" />}
                                            title="Print format"
                                            description="Choose the paper layout used for every voucher."
                                        />
                                        <Divider />
                                        <Grid container spacing={1.25}>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <PresetOption
                                                    active={voucherPrintForm.data.paper_size === 'A4'}
                                                    title="A4 document"
                                                    description="Best for office printers and full-page voucher records."
                                                    icon={<DocumentIcon fontSize="small" />}
                                                    onClick={() => voucherPrintForm.setData('paper_size', 'A4')}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <PresetOption
                                                    active={voucherPrintForm.data.paper_size === 'RECEIPT_80'}
                                                    title="Receipt 80mm"
                                                    description="Compact thermal format for counter and dispatch printing."
                                                    icon={<VoucherIcon fontSize="small" />}
                                                    onClick={() => voucherPrintForm.setData('paper_size', 'RECEIPT_80')}
                                                />
                                            </Grid>
                                        </Grid>
                                        {voucherPrintForm.errors.paper_size ? (
                                            <Typography variant="caption" color="error">
                                                {voucherPrintForm.errors.paper_size}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                </SettingsCard>

                                <SettingsCard>
                                    <Stack spacing={1.75}>
                                        <SettingsSectionTitle
                                            icon={<BrandingIcon fontSize="small" />}
                                            title="Voucher identity"
                                            description="Apply your organization name, subtitle, and logo."
                                        />
                                        <Divider />
                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, sm: 7 }}>
                                                <TextField
                                                    required
                                                    fullWidth
                                                    label="Header title"
                                                    value={voucherPrintForm.data.header_title}
                                                    onChange={(e) => voucherPrintForm.setData('header_title', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.header_title)}
                                                    helperText={voucherPrintForm.errors.header_title || 'Main organization or service name'}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 5 }}>
                                                <TextField
                                                    fullWidth
                                                    label="Header subtitle"
                                                    value={voucherPrintForm.data.header_subtitle}
                                                    onChange={(e) => voucherPrintForm.setData('header_subtitle', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.header_subtitle)}
                                                    helperText={voucherPrintForm.errors.header_subtitle || 'Example: Delivery voucher'}
                                                />
                                            </Grid>
                                        </Grid>

                                        <PreferenceSwitch
                                            title="Display logo"
                                            description="Show your uploaded logo beside the voucher heading."
                                            checked={voucherPrintForm.data.show_logo}
                                            onChange={(e) => voucherPrintForm.setData('show_logo', e.target.checked)}
                                        />

                                        <input
                                            ref={voucherPrintLogoFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={onVoucherPrintLogoFileChange}
                                        />
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2.25,
                                                borderStyle: 'dashed',
                                                bgcolor: 'rgba(15,23,42,0.018)',
                                            }}
                                        >
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}>
                                                <IconButton
                                                    onClick={openVoucherPrintLogoPicker}
                                                    disabled={voucherPrintLogoUploadForm.processing}
                                                    sx={{
                                                        width: 74,
                                                        height: 74,
                                                        borderRadius: 2,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        bgcolor: 'background.paper',
                                                        overflow: 'hidden',
                                                        p: 0,
                                                        flexShrink: 0,
                                                        '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(79,70,229,0.05)' },
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
                                                        <BrandingIcon sx={{ color: 'text.disabled' }} />
                                                    )}
                                                </IconButton>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                                        Voucher logo
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                                        Upload an image and crop it to a square. PNG, JPG, or WebP up to 2 MB.
                                                    </Typography>
                                                    {voucherPrintLogoUploadForm.errors.logo ? (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                            {voucherPrintLogoUploadForm.errors.logo}
                                                        </Typography>
                                                    ) : null}
                                                </Box>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<UploadIcon fontSize="small" />}
                                                    onClick={openVoucherPrintLogoPicker}
                                                    disabled={voucherPrintLogoUploadForm.processing}
                                                    sx={{ flexShrink: 0 }}
                                                >
                                                    Upload logo
                                                </Button>
                                            </Stack>
                                        </Paper>
                                        <TextField
                                            fullWidth
                                            label="Or use image URL"
                                            value={voucherPrintForm.data.logo_url}
                                            onChange={(e) => voucherPrintForm.setData('logo_url', e.target.value)}
                                            error={Boolean(voucherPrintForm.errors.logo_url)}
                                            helperText={voucherPrintForm.errors.logo_url || 'Optional direct image URL'}
                                        />
                                    </Stack>
                                </SettingsCard>

                                <SettingsCard>
                                    <Stack spacing={1.75}>
                                        <SettingsSectionTitle
                                            icon={<ContactIcon fontSize="small" />}
                                            title="Contact details"
                                            description="Include the contact information recipients may need."
                                        />
                                        <Divider />
                                        <PreferenceSwitch
                                            title="Display contact details"
                                            description="Add phone, email, and address below the voucher header."
                                            checked={voucherPrintForm.data.show_contact}
                                            onChange={(e) => voucherPrintForm.setData('show_contact', e.target.checked)}
                                        />
                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    disabled={!voucherPrintForm.data.show_contact}
                                                    label="Phone"
                                                    value={voucherPrintForm.data.contact_phone}
                                                    onChange={(e) => voucherPrintForm.setData('contact_phone', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.contact_phone)}
                                                    helperText={voucherPrintForm.errors.contact_phone || `${voucherPrintForm.data.contact_phone.length} / 50`}
                                                    inputProps={{ maxLength: 50 }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    disabled={!voucherPrintForm.data.show_contact}
                                                    label="Email"
                                                    value={voucherPrintForm.data.contact_email}
                                                    onChange={(e) => voucherPrintForm.setData('contact_email', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.contact_email)}
                                                    helperText={voucherPrintForm.errors.contact_email || `${voucherPrintForm.data.contact_email.length} / 50`}
                                                    inputProps={{ maxLength: 50 }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12 }}>
                                                <TextField
                                                    fullWidth
                                                    disabled={!voucherPrintForm.data.show_contact}
                                                    label="Address"
                                                    value={voucherPrintForm.data.contact_address}
                                                    onChange={(e) => voucherPrintForm.setData('contact_address', e.target.value)}
                                                    error={Boolean(voucherPrintForm.errors.contact_address)}
                                                    multiline
                                                    minRows={2}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                </SettingsCard>

                                <SettingsCard>
                                    <Stack spacing={1.75}>
                                        <SettingsSectionTitle
                                            icon={<ContentIcon fontSize="small" />}
                                            title="Optional content"
                                            description="Control the extra details printed at the end of the voucher."
                                        />
                                        <Divider />
                                        <TextField
                                            fullWidth
                                            label="Footer note"
                                            value={voucherPrintForm.data.footer_note}
                                            onChange={(e) => voucherPrintForm.setData('footer_note', e.target.value)}
                                            error={Boolean(voucherPrintForm.errors.footer_note)}
                                            helperText={voucherPrintForm.errors.footer_note || 'Example: Thank you for choosing our delivery service.'}
                                        />
                                        <Grid container spacing={1.25}>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <PreferenceSwitch
                                                    title="Payment status"
                                                    description="Print the voucher payment state."
                                                    checked={voucherPrintForm.data.show_payment_status}
                                                    onChange={(e) => voucherPrintForm.setData('show_payment_status', e.target.checked)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <PreferenceSwitch
                                                    title="Signature boxes"
                                                    description="Leave room for hand-off signatures."
                                                    checked={voucherPrintForm.data.show_signature_boxes}
                                                    onChange={(e) => voucherPrintForm.setData('show_signature_boxes', e.target.checked)}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                </SettingsCard>

                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2.5,
                                        bgcolor: voucherPrintForm.isDirty ? 'rgba(79,70,229,0.045)' : 'background.paper',
                                    }}
                                >
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                                {voucherPrintForm.isDirty ? 'Your preset has unsaved changes' : 'Voucher preset is up to date'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Save to apply this preset to future voucher prints.
                                            </Typography>
                                        </Box>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={voucherPrintForm.processing}
                                            startIcon={voucherPrintForm.processing ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                            sx={{ flexShrink: 0 }}
                                        >
                                            Save preset
                                        </Button>
                                    </Stack>
                                </Paper>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <SettingsCard sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
                                <Stack spacing={1.5}>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                                Live preview
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                Review the voucher while you customize it.
                                            </Typography>
                                        </Box>
                                        <Chip
                                            size="small"
                                            icon={<TuneIcon sx={{ fontSize: '16px !important' }} />}
                                            label={voucherPrintForm.data.paper_size === 'RECEIPT_80' ? '80mm' : 'A4'}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Stack>
                                    <Box
                                        sx={{
                                            bgcolor: 'rgba(15,23,42,0.035)',
                                            borderRadius: 2.5,
                                            p: voucherPrintForm.data.paper_size === 'RECEIPT_80' ? 1 : 1.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            overflowX: 'auto',
                                        }}
                                    >
                                        <VoucherPrintLivePreview voucher={voucherPrintPreviewVoucher} template={voucherPrintPreviewTemplate} />
                                    </Box>
                                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                        <CheckIcon color="success" sx={{ fontSize: 17 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            Preview updates instantly. Saving publishes the preset.
                                        </Typography>
                                    </Stack>
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
                <DialogTitle>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                Crop voucher logo
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Reposition the image inside the square frame.
                            </Typography>
                        </Box>
                        <IconButton onClick={closeCropper} disabled={cropUploading} aria-label="Close crop dialog">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
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
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                            Drag the image to reposition it.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeCropper} disabled={cropUploading}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={uploadCroppedImage} disabled={!img || cropUploading}>
                        {cropUploading ? 'Uploading...' : 'Use logo'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
