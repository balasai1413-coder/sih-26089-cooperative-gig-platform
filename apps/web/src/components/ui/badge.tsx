import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';

type Tone = 'neutral' | 'violet' | 'cyan' | 'success' | 'warning' | 'danger';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('badge', `badge--${tone}`, className)}>{children}</span>;
}

export function StatusBadge({
  status,
}: {
  status: 'Active' | 'Pending' | 'Verified' | 'New' | 'Attention';
}) {
  const tone: Record<typeof status, Tone> = {
    Active: 'success',
    Pending: 'warning',
    Verified: 'cyan',
    New: 'violet',
    Attention: 'danger',
  };
  return (
    <Badge tone={tone[status]}>
      <span className="badge__dot" />
      {status}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  const labels: Record<UserRole, string> = {
    CUSTOMER: 'Customer',
    WORKER: 'Worker',
    COOPERATIVE_ADMIN: 'Cooperative admin',
  };
  return (
    <Badge tone={role === 'WORKER' ? 'cyan' : role === 'COOPERATIVE_ADMIN' ? 'violet' : 'neutral'}>
      {labels[role]}
    </Badge>
  );
}

export function SkillBadge({ children }: { children: React.ReactNode }) {
  return <Badge tone="violet">{children}</Badge>;
}

export function VerificationBadge({ verified = true }: { verified?: boolean }) {
  return (
    <Badge tone={verified ? 'success' : 'warning'}>
      <Icon name={verified ? 'verify' : 'shield'} />
      {verified ? 'Verified' : 'Review pending'}
    </Badge>
  );
}
