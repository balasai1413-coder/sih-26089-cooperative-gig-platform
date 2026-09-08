import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = { title: 'Customer workspace' };

export default function CustomerDashboard() {
  return <DashboardShell kind="customer" />;
}
