'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { EmailInput, MobileInput, PasswordInput } from '@/components/ui/input';
import { Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import type { UserRole } from '@/types/auth';

type FormErrors = Record<string, string>;

const dashboardFor: Record<UserRole, string> = {
  CUSTOMER: '/dashboard/customer',
  WORKER: '/dashboard/worker',
  COOPERATIVE_ADMIN: '/dashboard/cooperative',
};

function mobileError(mobile: string): string | undefined {
  return /^\+[1-9]\d{7,14}$/.test(mobile.trim())
    ? undefined
    : 'Use international format, for example +919876543210.';
}

function passwordError(password: string): string | undefined {
  return password.length >= 8 ? undefined : 'Use at least 8 characters.';
}

function humanApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'We could not reach the service. Check your connection and try again.';
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const invalidMobile = mobileError(mobile);
    const invalidPassword = passwordError(password);
    if (invalidMobile) nextErrors.mobile = invalidMobile;
    if (invalidPassword) nextErrors.password = invalidPassword;
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      const session = await login({ mobile: mobile.trim(), password });
      const next = searchParams.get('next');
      router.replace(next?.startsWith('/dashboard/') ? next : dashboardFor[session.user.role]);
    } catch (error) {
      setFormError(humanApiError(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div className="auth-card__intro">
        <div className="auth-card__eyebrow">
          <Icon name="lock" />
          Secure sign in
        </div>
        <h2>Welcome back.</h2>
        <p>Your workspace is waiting.</p>
      </div>
      {formError ? (
        <Toast message={formError} tone="error" onDismiss={() => setFormError('')} />
      ) : null}
      <div className="auth-fields">
        <MobileInput
          label="Mobile number"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          error={errors.mobile}
          required
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
          required
        />
      </div>
      <Button
        className="auth-submit"
        type="submit"
        size="lg"
        loading={loading}
        icon="arrow-right"
        iconPosition="right"
      >
        Sign in
      </Button>
      <p className="auth-card__footer">
        New here? <Link href="/register/worker">Join as a worker</Link> <span>or</span>{' '}
        <Link href="/register/customer">as a customer</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ role }: { role: Extract<UserRole, 'CUSTOMER' | 'WORKER'> }) {
  const router = useRouter();
  const { register } = useAuth();
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const isWorker = role === 'WORKER';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const invalidMobile = mobileError(mobile);
    const invalidPassword = passwordError(password);
    if (invalidMobile) nextErrors.mobile = invalidMobile;
    if (invalidPassword) nextErrors.password = invalidPassword;
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim()))
      nextErrors.email = 'Enter a valid email address.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      const session = await register(role, {
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        password,
      });
      router.replace(dashboardFor[session.user.role]);
    } catch (error) {
      setFormError(humanApiError(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div className="auth-card__intro">
        <div className="auth-card__eyebrow">
          <Icon name={isWorker ? 'briefcase' : 'compass'} />
          {isWorker ? 'Worker account' : 'Customer account'}
        </div>
        <h2>{isWorker ? 'Put your skills in motion.' : 'Find good work, with confidence.'}</h2>
        <p>
          {isWorker
            ? 'Create your trusted professional space.'
            : 'Join the network in less than a minute.'}
        </p>
      </div>
      <div className="role-switch" aria-label="Choose account type">
        <Link href="/register/customer" className={!isWorker ? 'is-active' : ''}>
          <Icon name="compass" />
          Customer
        </Link>
        <Link href="/register/worker" className={isWorker ? 'is-active' : ''}>
          <Icon name="briefcase" />
          Worker
        </Link>
      </div>
      {formError ? (
        <Toast message={formError} tone="error" onDismiss={() => setFormError('')} />
      ) : null}
      <div className="auth-fields">
        <MobileInput
          label="Mobile number"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          error={errors.mobile}
          required
        />
        <EmailInput
          label="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          hint="Optional — helpful for account recovery."
        />
        <PasswordInput
          label="Create password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          autoComplete="new-password"
          required
        />
      </div>
      <Button
        className="auth-submit"
        type="submit"
        size="lg"
        loading={loading}
        icon="arrow-right"
        iconPosition="right"
      >
        Create {isWorker ? 'worker' : 'customer'} account
      </Button>
      <p className="auth-card__terms">
        By creating an account, you agree to build a respectful, trusted community.
      </p>
      <p className="auth-card__footer">
        Already with us? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
