'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Brand } from '@/components/brand';
import { Icon, type IconName } from '@/components/icons';
import { RoleBadge, StatusBadge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { CooperativeMembers } from '@/components/cooperative/cooperative-members';
import { CooperativeOverview } from '@/components/cooperative/cooperative-overview';
import { CooperativeSkillCatalog } from '@/components/cooperative/cooperative-skill-catalog';
import { CooperativeVerificationStudio } from '@/components/cooperative/cooperative-verification-studio';
import { CustomerRequests } from '@/components/customer/customer-requests';
import { CustomerBookings } from '@/components/customer/customer-bookings';
import { CustomerPayments } from '@/components/customer/customer-payments';
import { WorkerAssignments } from '@/components/worker/worker-assignments';
import { WorkerPayments } from '@/components/worker/worker-payments';
import {
  WorkerProfileStudio,
  type WorkerStudioSection,
} from '@/components/worker/worker-profile-studio';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';

type DashboardKind = 'customer' | 'worker' | 'cooperative';
type NavItem = { label: string; icon: IconName };

const dashboardFor: Record<UserRole, string> = {
  CUSTOMER: '/dashboard/customer',
  WORKER: '/dashboard/worker',
  COOPERATIVE_ADMIN: '/dashboard/cooperative',
};
const roleFor: Record<DashboardKind, UserRole> = {
  customer: 'CUSTOMER',
  worker: 'WORKER',
  cooperative: 'COOPERATIVE_ADMIN',
};
const configs: Record<
  DashboardKind,
  {
    label: string;
    labelShort: string;
    nav: NavItem[];
    greeting: string;
    description: string;
    accent: string;
  }
> = {
  customer: {
    label: 'Customer workspace',
    labelShort: 'Customer',
    nav: [
      { label: 'Discover', icon: 'compass' },
      { label: 'My requests', icon: 'briefcase' },
      { label: 'Bookings', icon: 'verify' },
      { label: 'Payments', icon: 'sparkles' },
      { label: 'Notifications', icon: 'message' },
      { label: 'Profile', icon: 'user' },
    ],
    greeting: 'Make your next choice a good one.',
    description: 'A thoughtful starting point for discovering trusted talent.',
    accent: 'violet',
  },
  worker: {
    label: 'Worker workspace',
    labelShort: 'Worker',
    nav: [
      { label: 'Profile', icon: 'user' },
      { label: 'Assignments', icon: 'briefcase' },
      { label: 'Payments', icon: 'verify' },
      { label: 'Payments', icon: 'sparkles' },
      { label: 'Skills', icon: 'zap' },
      { label: 'Evidence', icon: 'shield' },
      { label: 'Certificates', icon: 'verify' },
      { label: 'Verification', icon: 'briefcase' },
    ],
    greeting: 'Your work is going places.',
    description: 'A clear view of your skills, reputation, and next opportunities.',
    accent: 'cyan',
  },
  cooperative: {
    label: 'Cooperative studio',
    labelShort: 'Cooperative',
    nav: [
      { label: 'Overview', icon: 'grid' },
      { label: 'Workers', icon: 'users' },
      { label: 'Skills', icon: 'zap' },
      { label: 'Verification', icon: 'verify' },
      { label: 'Requests', icon: 'briefcase' },
      { label: 'Analytics', icon: 'sparkles' },
    ],
    greeting: 'Build the conditions for people to thrive.',
    description: 'A single calm place to guide your cooperative and its potential.',
    accent: 'amber',
  },
};

function initialOf(mobile?: string) {
  const digits = mobile?.replace(/\D/g, '');
  return digits ? digits.at(-1) : 'S';
}

export function DashboardShell({ kind }: { kind: DashboardKind }) {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(configs[kind].nav[0].label);
  const [sideOpen, setSideOpen] = useState(false);
  const config = configs[kind];
  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status === 'authenticated' && user && user.role !== roleFor[kind])
      router.replace(dashboardFor[user.role]);
  }, [kind, pathname, router, status, user]);
  if (status === 'loading' || !user || user.role !== roleFor[kind]) return <DashboardLoading />;
  const items = config.nav;
  async function signOut() {
    await logout();
    router.replace('/');
  }
  return (
    <div className={cn('dashboard', `dashboard--${config.accent}`)}>
      <aside className={cn('dashboard-sidebar', sideOpen && 'is-open')}>
        <div className="dashboard-sidebar__top">
          <Brand inverse />
          <IconButton
            label="Close navigation"
            icon="close"
            size="sm"
            className="dashboard-sidebar__close"
            onClick={() => setSideOpen(false)}
          />
        </div>
        <div className="workspace-label">
          <span>{config.labelShort}</span>
          <i />
        </div>
        <nav className="dashboard-nav" aria-label="Workspace navigation">
          {items.map((item) => (
            <button
              key={item.label}
              className={cn(active === item.label && 'is-active')}
              type="button"
              onClick={() => {
                setActive(item.label);
                setSideOpen(false);
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="dashboard-sidebar__bottom">
          <div className="sidebar-profile">
            <span className="sidebar-profile__avatar">{initialOf(user.mobile)}</span>
            <div>
              <b>{user.email?.split('@')[0] ?? 'Member'}</b>
              <RoleBadge role={user.role} />
            </div>
            <IconButton label="Sign out" icon="log-out" size="sm" onClick={() => void signOut()} />
          </div>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <IconButton
              label="Open navigation"
              icon="menu"
              size="sm"
              className="dashboard-menu-button"
              onClick={() => setSideOpen(true)}
            />
            <p className="dashboard-topbar__crumb">
              {config.label} <Icon name="chevron-down" />
            </p>
          </div>
          <div className="dashboard-topbar__right">
            <label className="dashboard-search">
              <Icon name="search" />
              <span className="sr-only">Search workspace</span>
              <input placeholder="Search workspace" />
            </label>
            <IconButton
              label="Notifications"
              icon="message"
              size="sm"
              className="notification-button"
            />
            <span className="topbar-avatar">{initialOf(user.mobile)}</span>
          </div>
        </header>
        <main className="dashboard-content">
          <DashboardView
            kind={kind}
            active={active}
            userName={user.email?.split('@')[0] ?? 'there'}
          />
        </main>
        <nav className="dashboard-mobile-nav" aria-label="Mobile workspace navigation">
          {items.slice(0, 4).map((item) => (
            <button
              key={item.label}
              className={cn(active === item.label && 'is-active')}
              type="button"
              onClick={() => setActive(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="dashboard-loading">
      <div className="dashboard-loading__side">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <main>
        <Skeleton className="dashboard-loading__title" />
        <Skeleton className="dashboard-loading__body" />
        <div className="dashboard-loading__stats">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </main>
    </div>
  );
}

function DashboardView({
  kind,
  active,
  userName,
}: {
  kind: DashboardKind;
  active: string;
  userName: string;
}) {
  if (kind === 'worker' && active === 'Assignments') return <WorkerAssignments />;
  if (kind === 'worker' && active === 'Payments') return <WorkerPayments />;
  if (kind === 'worker') return <WorkerProfileStudio active={active as WorkerStudioSection} />;
  if (kind === 'customer' && active === 'My requests') return <CustomerRequests />;
  if (kind === 'customer' && active === 'Bookings') return <CustomerBookings />;
  if (kind === 'customer' && active === 'Payments') return <CustomerPayments />;
  if (kind === 'cooperative' && active === 'Verification') return <CooperativeVerificationStudio />;
  if (kind === 'cooperative' && active === 'Overview') return <CooperativeOverview />;
  if (kind === 'cooperative' && active === 'Workers') return <CooperativeMembers />;
  if (kind === 'cooperative' && active === 'Skills') return <CooperativeSkillCatalog />;
  const showingOverview = active === configs[kind].nav[0].label;
  if (!showingOverview) return <PlaceholderView kind={kind} active={active} />;
  if (kind === 'customer') return <CustomerOverview userName={userName} />;
  return <CooperativeOverview />;
}

function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dashboard-page-intro">
      <div>
        <p className="dashboard-overline">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function CustomerOverview({ userName }: { userName: string }) {
  return (
    <>
      <PageIntro
        eyebrow="Your starting point"
        title={`Good to see you, ${userName}.`}
        description="Discover the people and skills that can move your plans forward."
        action={<Button icon="search">Discover services</Button>}
      />
      <div className="stat-grid">
        <StatCard
          label="Saved professionals"
          value="—"
          change="Your shortlist will appear here"
          icon={<Icon name="user" />}
        />
        <StatCard
          label="Active requests"
          value="—"
          change="Ready when you are"
          tone="cyan"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="Trusted network"
          value="Growing"
          change="More verified talent, every week"
          tone="emerald"
          icon={<Icon name="verify" />}
        />
      </div>
      <section className="dashboard-split">
        <GlassCard className="discover-card">
          <div className="card-heading">
            <div>
              <p>Explore your network</p>
              <h2>What would you like to get done?</h2>
            </div>
            <Icon name="compass" />
          </div>
          <div className="discover-card__search">
            <Icon name="search" />
            <span>Search skills or services</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="category-pills">
            <button type="button">Home services</button>
            <button type="button">Creative work</button>
            <button type="button">Learning</button>
          </div>
          <span className="card-footnote">
            Discovery will become available as the service catalogue comes online.
          </span>
        </GlassCard>
        <GlassCard className="activity-card">
          <div className="card-heading">
            <div>
              <p>Activity</p>
              <h2>Your space is clear.</h2>
            </div>
            <StatusBadge status="New" />
          </div>
          <EmptyState
            icon="briefcase"
            title="Your requests will live here."
            description="When you are ready, create a request and follow it from one calm place."
          />
        </GlassCard>
      </section>
    </>
  );
}

function PlaceholderView({ kind, active }: { kind: DashboardKind; active: string }) {
  const config = configs[kind];
  const descriptions: Record<string, string> = {
    'My requests': 'Requests you make will be collected here.',
    Bookings: 'Your confirmed services will appear here.',
    Notifications: 'Important updates will find their way here.',
    Profile: 'Your identity and preferences will have a home here.',
    'My skills': 'The skills that tell your professional story will appear here.',
    Verification: 'Your verification path will be easy to follow here.',
    Requests: 'Relevant requests will arrive here.',
    Workers: 'Your member network will live here.',
    Skills: 'Your collective skill map will form here.',
    Analytics: 'Clear cooperative insights will take shape here.',
  };
  const icon = config.nav.find((item) => item.label === active)?.icon ?? 'grid';
  return (
    <>
      <PageIntro
        eyebrow={config.label}
        title={active}
        description={descriptions[active] ?? 'This workspace area is getting ready for you.'}
      />
      <GlassCard className="dashboard-placeholder">
        <EmptyState
          icon={icon === 'users' ? 'users' : icon === 'briefcase' ? 'briefcase' : 'compass'}
          title={`${active} is on its way.`}
          description="The foundation is ready. This space will connect to its dedicated product workflow in a later release."
        />
      </GlassCard>
    </>
  );
}
