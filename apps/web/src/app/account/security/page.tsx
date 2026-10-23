import type { Metadata } from 'next';
import { ChangePasswordCard, SessionsCard } from '@/components/account/security';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security" description="Password and signed-in devices." />
      <div className="grid max-w-2xl gap-6">
        <ChangePasswordCard />
        <SessionsCard />
      </div>
    </>
  );
}
