import type { Metadata } from 'next';
import { AdminAuditLogsPage } from '@/components/admin/admin-pages';

export const metadata: Metadata = { title: 'Platform · Audit log' };

export default function Page() {
  return <AdminAuditLogsPage />;
}
