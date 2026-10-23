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
        title="Audit log"
        description="Security-relevant events in this workspace. Entries cannot be edited or deleted."
      />
      <AuditLogTable useData={useData} />
    </>
  );
}
