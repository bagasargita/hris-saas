import type { Metadata } from 'next';
import { SettingsPage } from '@/components/tenant/settings-page';

export const metadata: Metadata = { title: 'Pengaturan' };

export default function Page() {
  return <SettingsPage />;
}
