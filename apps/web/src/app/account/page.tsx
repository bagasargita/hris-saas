import type { Metadata } from 'next';
import { ProfileForm } from '@/components/account/profile-form';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const me = await requireUser('/account');
  return (
    <>
      <PageHeader title="Account" description="Manage your personal details." />
      <ProfileForm user={me.user} />
    </>
  );
}
