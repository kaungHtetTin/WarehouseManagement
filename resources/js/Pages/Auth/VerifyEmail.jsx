import GuestLayout from '@/Layouts/GuestLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useT } from '@/i18n';

export default function VerifyEmail({ status }) {
    const { admin_app_url } = usePage().props;
    const t = useT();
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(`${admin_app_url}/email/verification-notification`);
    };

    return (
        <GuestLayout>
            <Head title={t('auth.email_verification_title')} />

            <div className="mb-4 text-sm text-gray-600">
                {t('verify_email.description')}
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 font-medium text-sm text-green-600">
                    {t('verify_email.link_sent')}
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>{t('verify_email.resend')}</PrimaryButton>

                    <Link
                        href={`${admin_app_url}/logout`}
                        method="post"
                        as="button"
                        className="underline text-sm text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        {t('auth.log_out')}
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
