import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Join as a worker' };

export default function WorkerRegisterPage() {
  return (
    <AuthShell mode="worker">
      <RegisterForm role="WORKER" />
    </AuthShell>
  );
}
