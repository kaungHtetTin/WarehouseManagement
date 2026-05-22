import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';

export default function ForgotPassword({ status }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const onHandleChange = (event) => {
        setData(event.target.name, event.target.value);
    };

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/forgot-password`);
    };

    return (
        <GuestLayout>
            <Head title={t('auth.forgot_password_title')} />

            <div className="mb-4 text-sm text-gray-600">
                {t('forgot_password.description')}
            </div>

            {status && <div className="mb-4 font-medium text-sm text-green-600">{status}</div>}

            <form onSubmit={submit}>
                <TextInput
                    id="email"
                    type="email"
                    name="email"
                    value={data.email}
                    className="mt-1 block w-full"
                    isFocused={true}
                    onChange={onHandleChange}
                />

                <InputError message={errors.email} className="mt-2" />

                <div className="flex items-center justify-end mt-4">
                    <PrimaryButton className="ml-4" disabled={processing}>
                        {t('forgot_password.email_reset_link')}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
