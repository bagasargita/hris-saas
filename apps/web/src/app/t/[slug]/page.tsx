import type { Metadata } from 'next';
import { Dashboard } from '@/components/tenant/dashboard';

export const metadata: Metadata = { title: 'Ringkasan' };

export default function TenantDashboardPage() {
  return <Dashboard />;
}
