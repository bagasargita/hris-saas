import type { Metadata } from 'next';
import { ProfileForm } from '@/components/account/profile-form';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Akun' };

export default async function AccountPage() {
  const me = await requireUser('/account');
  return (
    <>
      <PageHeader title="Akun" description="Kelola detail pribadi Anda." />
      <ProfileForm user={me.user} />
    </>
  );
}
