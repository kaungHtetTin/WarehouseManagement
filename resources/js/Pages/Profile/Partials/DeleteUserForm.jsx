import { useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useT } from '@/i18n';

export default function DeleteUserForm({ className }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(`${admin_app_url}/profile`, {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        reset();
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('profile.delete.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('profile.delete.description')}
                </Typography>
            </Stack>

            <Button size="small" color="error" variant="outlined" sx={{ mt: 1.5 }} onClick={confirmUserDeletion}>
                {t('profile.delete.button')}
            </Button>

            <Dialog open={confirmingUserDeletion} onClose={closeModal} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 700 }}>{t('profile.delete.confirm_title')}</DialogTitle>
                <Box component="form" onSubmit={deleteUser}>
                    <DialogContent sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('profile.delete.confirm_description')}
                        </Typography>
                        <TextField
                            id="password"
                            type="password"
                            name="password"
                            fullWidth
                            size="small"
                            label={t('auth.password')}
                            inputRef={passwordInput}
                            autoFocus
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            error={Boolean(errors.password)}
                            helperText={errors.password}
                        />
                        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
                            {t('profile.delete.warning')}
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={closeModal}>{t('ui.cancel')}</Button>
                        <Button type="submit" color="error" variant="contained" disabled={processing}>
                            {t('profile.delete.button')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
