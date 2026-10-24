import type { Metadata } from 'next';
import { AttendanceCalendarPage } from '@/components/tenant/attendance/calendar-page';

export const metadata: Metadata = { title: 'Kalender absensi' };

export default function Page() {
  return <AttendanceCalendarPage />;
}
