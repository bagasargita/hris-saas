import type { Metadata } from 'next';
import { AuditLogsPage } from '@/components/tenant/audit-logs-page';

export const metadata: Metadata = { title: 'Audit log' };

export default function Page() {
  return <AuditLogsPage />;
}
