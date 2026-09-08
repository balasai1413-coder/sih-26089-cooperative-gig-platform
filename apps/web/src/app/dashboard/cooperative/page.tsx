import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata: Metadata = { title: 'Cooperative studio' };

export default function CooperativeDashboard() {
  return <DashboardShell kind="cooperative" />;
}
