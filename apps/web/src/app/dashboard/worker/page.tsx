import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = { title: 'Worker workspace' };

export default function WorkerDashboard() {
  return <DashboardShell kind="worker" />;
}
