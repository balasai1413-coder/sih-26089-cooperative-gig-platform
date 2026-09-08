import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell mode="login">
      <Suspense fallback={<div className="auth-card" aria-busy="true" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
