import type { Metadata } from 'next';
import { AuditLogsPage } from '@/components/tenant/audit-logs-page';

export const metadata: Metadata = { title: 'Log audit' };

export default function Page() {
  return <AuditLogsPage />;
}
