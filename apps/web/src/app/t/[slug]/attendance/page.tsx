import type { Metadata } from 'next';
import { AttendanceClockPage } from '@/components/tenant/attendance/clock-page';

export const metadata: Metadata = { title: 'Absensi' };

export default function Page() {
  return <AttendanceClockPage />;
}
