import { useRef } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';

export default function UpdatePasswordForm({ className }) {
    const { admin_app_url } = usePage().props;
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(`${admin_app_url}/password`, {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: () => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing={0.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Update Password
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Ensure your account is using a long, random password to stay secure.
                </Typography>
            </Stack>

            <Box component="form" onSubmit={updatePassword} sx={{ mt: 3 }}>
                <Stack spacing={2}>
                    <TextField
                        id="current_password"
                        type="password"
                        label="Current Password"
                        fullWidth
                        inputRef={currentPasswordInput}
                        autoComplete="current-password"
                        value={data.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                        error={Boolean(errors.current_password)}
                        helperText={errors.current_password}
                    />

                    <TextField
                        id="password"
                        type="password"
                        label="New Password"
                        fullWidth
                        inputRef={passwordInput}
                        autoComplete="new-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={Boolean(errors.password)}
                        helperText={errors.password}
                    />

                    <TextField
                        id="password_confirmation"
                        type="password"
                        label="Confirm Password"
                        fullWidth
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        error={Boolean(errors.password_confirmation)}
                        helperText={errors.password_confirmation}
                    />

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Button type="submit" variant="contained" disabled={processing}>
                            Save
                        </Button>
                        <Transition show={recentlySuccessful} enterFrom="opacity-0" leaveTo="opacity-0" className="transition ease-in-out">
                            <Typography variant="body2" color="text.secondary">
                                Saved.
                            </Typography>
                        </Transition>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}
