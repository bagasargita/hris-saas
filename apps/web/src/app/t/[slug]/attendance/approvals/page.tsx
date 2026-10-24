import type { Metadata } from 'next';
import { AttendanceApprovalsPage } from '@/components/tenant/attendance/approvals-page';

export const metadata: Metadata = { title: 'Persetujuan absensi' };

export default function Page() {
  return <AttendanceApprovalsPage />;
}
