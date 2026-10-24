import type { Metadata } from 'next';
import { AttendanceSitesPage } from '@/components/tenant/attendance/sites-page';

export const metadata: Metadata = { title: 'Lokasi' };

export default function Page() {
  return <AttendanceSitesPage />;
}
