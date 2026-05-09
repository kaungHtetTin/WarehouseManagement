import { Link, useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className }) {
    const { auth, admin_app_url } = usePage().props;
    const user = auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: user.name,
        email: user.email,
    });

    const submit = (e) => {
        e.preventDefault();

        patch(`${admin_app_url}/profile`);
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing={0.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Profile Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Update your account&apos;s profile information and email address.
                </Typography>
            </Stack>

            <Box component="form" onSubmit={submit} sx={{ mt: 3 }}>
                <Stack spacing={2}>
                    <TextField
                        id="name"
                        label="Name"
                        fullWidth
                        required
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
                        label="Email"
                        fullWidth
                        required
                        autoComplete="username"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={Boolean(errors.email)}
                        helperText={errors.email}
                    />

                    {mustVerifyEmail && user.email_verified_at === null && (
                        <Stack spacing={1}>
                            <Alert severity="warning" variant="outlined">
                                Your email address is unverified.
                            </Alert>
                            <Typography variant="body2">
                                <Link href={`${admin_app_url}/email/verification-notification`} method="post" as="button">
                                    Re-send verification email
                                </Link>
                            </Typography>
                            {status === 'verification-link-sent' && (
                                <Alert severity="success" variant="outlined">
                                    A new verification link has been sent to your email address.
                                </Alert>
                            )}
                        </Stack>
                    )}

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
