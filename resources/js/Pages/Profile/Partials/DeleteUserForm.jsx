import { useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

export default function DeleteUserForm({ className }) {
    const { admin_app_url } = usePage().props;
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
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Delete Account
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Once your account is deleted, all resources and data will be permanently deleted.
                </Typography>
            </Stack>

            <Button color="error" variant="outlined" sx={{ mt: 2 }} onClick={confirmUserDeletion}>
                Delete Account
            </Button>

            <Dialog open={confirmingUserDeletion} onClose={closeModal} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 700 }}>Are you sure you want to delete your account?</DialogTitle>
                <Box component="form" onSubmit={deleteUser}>
                    <DialogContent sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            This action is permanent. Enter your password to confirm account deletion.
                        </Typography>
                        <TextField
                            id="password"
                            type="password"
                            name="password"
                            fullWidth
                            label="Password"
                            inputRef={passwordInput}
                            autoFocus
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            error={Boolean(errors.password)}
                            helperText={errors.password}
                        />
                        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
                            This cannot be undone.
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={closeModal}>Cancel</Button>
                        <Button type="submit" color="error" variant="contained" disabled={processing}>
                            Delete Account
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
