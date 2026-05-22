import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';
import ProfileImageCropDialog from '@/Components/ProfileImageCropDialog';
import { useT } from '@/i18n';
import { Alert, Avatar, Box, Button, Stack, TextField, Typography } from '@mui/material';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className }) {
    const { auth, admin_app_url } = usePage().props;
    const t = useT();
    const user = auth.user;
    const fileInputRef = useRef(null);
    const [cropSource, setCropSource] = useState(null);
    const [cropSourceType, setCropSourceType] = useState('image/png');
    const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

    const { data, setData, post, errors, processing, recentlySuccessful } = useForm({
        name: user.name ?? '',
        email: user.email ?? '',
        profile_image: null,
        remove_profile_image: false,
        _method: 'patch',
    });

    useEffect(() => () => {
        if (localPreviewUrl) {
            URL.revokeObjectURL(localPreviewUrl);
        }
    }, [localPreviewUrl]);

    const activePreviewUrl = useMemo(() => {
        if (localPreviewUrl) return localPreviewUrl;
        if (data.remove_profile_image) return null;
        return user.profile_image_url ?? null;
    }, [data.remove_profile_image, localPreviewUrl, user.profile_image_url]);

    const avatarInitial = String(data.name || user.name || '?')
        .trim()
        .slice(0, 1)
        .toUpperCase();

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/profile`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setData('profile_image', null);
                setData('remove_profile_image', false);
                if (localPreviewUrl) {
                    URL.revokeObjectURL(localPreviewUrl);
                }
                setLocalPreviewUrl(null);
            },
        });
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        setCropSourceType(file.type || 'image/png');

        const reader = new FileReader();
        reader.onload = () => {
            setCropSource(typeof reader.result === 'string' ? reader.result : null);
        };
        reader.readAsDataURL(file);
    };

    const handleCropConfirm = async (file) => {
        if (localPreviewUrl) {
            URL.revokeObjectURL(localPreviewUrl);
        }

        setData('profile_image', file);
        setData('remove_profile_image', false);
        setLocalPreviewUrl(URL.createObjectURL(file));
        setCropSource(null);
    };

    const handleRemovePhoto = () => {
        if (localPreviewUrl) {
            URL.revokeObjectURL(localPreviewUrl);
        }

        setLocalPreviewUrl(null);
        setData('profile_image', null);
        setData('remove_profile_image', true);
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('profile.info.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('profile.info.description')}
                </Typography>
            </Stack>

            <Box component="form" onSubmit={submit} sx={{ mt: 2 }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        sx={{ alignItems: { xs: 'flex-start', md: 'center' } }}
                    >
                        <Avatar
                            src={activePreviewUrl || undefined}
                            alt={data.name || user.name || t('nav.profile')}
                            sx={{
                                width: 88,
                                height: 88,
                                fontSize: 28,
                                fontWeight: 800,
                                bgcolor: 'primary.main',
                            }}
                        >
                            {avatarInitial}
                        </Avatar>
                        <Stack spacing={1} sx={{ minWidth: 0 }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    {t('profile.info.image_title')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('profile.info.image_description')}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()}>
                                    {activePreviewUrl ? t('profile.info.change_photo') : t('profile.info.upload_photo')}
                                </Button>
                                {(activePreviewUrl || data.profile_image) ? (
                                    <Button size="small" variant="text" color="error" onClick={handleRemovePhoto}>
                                        {t('profile.info.remove_photo')}
                                    </Button>
                                ) : null}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                                {t('profile.info.photo_hint')}
                            </Typography>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                hidden
                                onChange={handleFileChange}
                            />
                            {errors.profile_image ? (
                                <Typography variant="caption" color="error.main">
                                    {errors.profile_image}
                                </Typography>
                            ) : null}
                        </Stack>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                        <TextField
                            id="name"
                            label={t('iam.users.fields.name')}
                            fullWidth
                            required
                            size="small"
                            autoComplete="name"
                            autoFocus
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={Boolean(errors.name)}
                            helperText={errors.name}
                        />

                        <TextField
                            id="email"
                            type="email"
                            label={t('auth.email')}
                            fullWidth
                            required
                            size="small"
                            autoComplete="username"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            error={Boolean(errors.email)}
                            helperText={errors.email}
                        />
                    </Stack>

                    {mustVerifyEmail && user.email_verified_at === null ? (
                        <Stack spacing={1}>
                            <Alert severity="warning" variant="outlined">
                                {t('profile.info.verification_unverified')}
                            </Alert>
                            <Typography variant="body2">
                                <Link href={`${admin_app_url}/email/verification-notification`} method="post" as="button">
                                    {t('profile.info.verification_resend')}
                                </Link>
                            </Typography>
                            {status === 'verification-link-sent' ? (
                                <Alert severity="success" variant="outlined">
                                    {t('profile.info.verification_sent')}
                                </Alert>
                            ) : null}
                        </Stack>
                    ) : null}

                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Button type="submit" size="small" variant="contained" disabled={processing}>
                            {t('ui.save')}
                        </Button>
                        <Transition show={recentlySuccessful} enterFrom="opacity-0" leaveTo="opacity-0" className="transition ease-in-out">
                            <Typography variant="body2" color="text.secondary">
                                {t('profile.common.saved')}
                            </Typography>
                        </Transition>
                    </Stack>
                </Stack>
            </Box>

            <ProfileImageCropDialog
                open={Boolean(cropSource)}
                imageSrc={cropSource}
                sourceType={cropSourceType}
                t={t}
                onClose={() => setCropSource(null)}
                onConfirm={handleCropConfirm}
            />
        </Box>
    );
}
