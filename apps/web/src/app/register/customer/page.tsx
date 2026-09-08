import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Join as a customer' };

export default function CustomerRegisterPage() {
  return (
    <AuthShell mode="customer">
      <RegisterForm role="CUSTOMER" />
    </AuthShell>
  );
}
