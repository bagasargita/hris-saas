import type { Metadata } from 'next';
import { AttendanceSchedulesPage } from '@/components/tenant/attendance/schedules-page';

export const metadata: Metadata = { title: 'Jadwal' };

export default function Page() {
  return <AttendanceSchedulesPage />;
}
