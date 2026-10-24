import type { Metadata } from 'next';
import { MembersPage } from '@/components/tenant/members-page';

export const metadata: Metadata = { title: 'Anggota' };

export default function Page() {
  return <MembersPage />;
}
