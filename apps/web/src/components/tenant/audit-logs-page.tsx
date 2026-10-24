'use client';

import { AuditLogTable } from '@/components/audit-log-table';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied } from '@/components/states';
import { useAuditLogs, type AuditListParams } from '@/lib/api/hooks';
import { useTenant } from './tenant-context';

export function AuditLogsPage() {
  const { tenant, can } = useTenant();
  const useData = (params: AuditListParams) => useAuditLogs(tenant.id, params);

  if (!can('audit_logs.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Log audit"
        description="Peristiwa terkait keamanan di workspace ini. Entri tidak dapat diedit atau dihapus."
      />
      <AuditLogTable useData={useData} />
    </>
  );
}
