import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Stack, Typography } from '@mui/material';

const CROP_SIZE = 280;
const OUTPUT_SIZE = 512;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ProfileImageCropDialog({ open, imageSrc, sourceType = 'image/png', t, onClose, onConfirm }) {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [imageMeta, setImageMeta] = useState({ width: 1, height: 1 });
    const [dragState, setDragState] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) return;
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setImageMeta({ width: 1, height: 1 });
        setProcessing(false);
    }, [open, imageSrc]);

    const bounds = useMemo(() => {
        const baseScale = Math.max(CROP_SIZE / imageMeta.width, CROP_SIZE / imageMeta.height);
        const width = imageMeta.width * baseScale * zoom;
        const height = imageMeta.height * baseScale * zoom;

        return {
            width,
            height,
            maxX: Math.max(0, (width - CROP_SIZE) / 2),
            maxY: Math.max(0, (height - CROP_SIZE) / 2),
        };
    }, [imageMeta.height, imageMeta.width, zoom]);

    const setClampedPosition = (next) => {
        setPosition({
            x: clamp(next.x, -bounds.maxX, bounds.maxX),
            y: clamp(next.y, -bounds.maxY, bounds.maxY),
        });
    };

    useEffect(() => {
        setClampedPosition(position);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bounds.maxX, bounds.maxY]);

    useEffect(() => {
        if (!dragState) return undefined;

        const handlePointerMove = (event) => {
            const point = 'touches' in event ? event.touches[0] : event;
            if (!point) return;

            setClampedPosition({
                x: dragState.origin.x + (point.clientX - dragState.start.x),
                y: dragState.origin.y + (point.clientY - dragState.start.y),
            });
        };

        const handlePointerUp = () => setDragState(null);

        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchmove', handlePointerMove, { passive: false });
        window.addEventListener('touchend', handlePointerUp);

        return () => {
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, [dragState, bounds.maxX, bounds.maxY]);

    const handleZoomChange = (_, value) => {
        setZoom(Array.isArray(value) ? value[0] : value);
    };

    const handleConfirm = async () => {
        setProcessing(true);

        try {
            const image = await new Promise((resolve, reject) => {
                const nextImage = new window.Image();
                nextImage.onload = () => resolve(nextImage);
                nextImage.onerror = reject;
                nextImage.src = imageSrc;
            });

            const canvas = document.createElement('canvas');
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;

            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Canvas context is unavailable.');
            }

            const scaleRatio = OUTPUT_SIZE / CROP_SIZE;
            const drawWidth = bounds.width * scaleRatio;
            const drawHeight = bounds.height * scaleRatio;
            const drawX = ((CROP_SIZE - bounds.width) / 2 + position.x) * scaleRatio;
            const drawY = ((CROP_SIZE - bounds.height) / 2 + position.y) * scaleRatio;

            context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
            context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

            const normalizedType = ['image/png', 'image/jpeg', 'image/webp'].includes(sourceType) ? sourceType : 'image/png';
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                        return;
                    }

                    reject(new Error('Failed to export cropped image.'));
                }, normalizedType, 0.92);
            });

            const extension = normalizedType === 'image/jpeg' ? 'jpg' : normalizedType === 'image/webp' ? 'webp' : 'png';
            const file = new File([blob], `profile-image.${extension}`, { type: normalizedType });
            await onConfirm(file);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={open} onClose={processing ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>{t('profile.info.crop_title')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('profile.info.crop_description')}
                    </Typography>

                    <Box
                        onMouseDown={(event) => {
                            event.preventDefault();
                            setDragState({
                                start: { x: event.clientX, y: event.clientY },
                                origin: position,
                            });
                        }}
                        onTouchStart={(event) => {
                            const point = event.touches[0];
                            if (!point) return;
                            setDragState({
                                start: { x: point.clientX, y: point.clientY },
                                origin: position,
                            });
                        }}
                        sx={{
                            width: CROP_SIZE,
                            height: CROP_SIZE,
                            mx: 'auto',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: 4,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: dragState ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            touchAction: 'none',
                        }}
                    >
                        {imageSrc ? (
                            <Box
                                component="img"
                                src={imageSrc}
                                alt={t('profile.info.current_photo')}
                                onLoad={(event) => {
                                    setImageMeta({
                                        width: event.currentTarget.naturalWidth || 1,
                                        height: event.currentTarget.naturalHeight || 1,
                                    });
                                }}
                                draggable={false}
                                sx={{
                                    position: 'absolute',
                                    left: `calc(50% + ${position.x}px)`,
                                    top: `calc(50% + ${position.y}px)`,
                                    width: bounds.width,
                                    height: bounds.height,
                                    transform: 'translate(-50%, -50%)',
                                    pointerEvents: 'none',
                                }}
                            />
                        ) : null}
                    </Box>

                    <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary">
                            {t('profile.info.zoom')}
                        </Typography>
                        <Slider min={1} max={3} step={0.01} value={zoom} onChange={handleZoomChange} />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={processing}>
                    {t('ui.cancel')}
                </Button>
                <Button onClick={handleConfirm} variant="contained" disabled={processing}>
                    {t('profile.info.crop_apply')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
