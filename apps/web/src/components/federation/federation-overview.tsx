'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { federationApi } from '@/lib/api/federation';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  FederationCooperative,
  FederationOverview,
  FederationWelfare,
  FederationWorkforce,
} from '@/types/federation';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'We could not load federation intelligence.';
}

export function FederationOverviewView() {
  const { accessToken } = useAuth();
  const [overview, setOverview] = useState<FederationOverview | null>(null);
  const [cooperatives, setCooperatives] = useState<FederationCooperative[]>([]);
  const [workforce, setWorkforce] = useState<FederationWorkforce | null>(null);
  const [welfare, setWelfare] = useState<FederationWelfare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const federations = await federationApi.list(accessToken);
        const federation = federations[0];
        if (!federation) return;
        const [nextOverview, nextCooperatives, nextWorkforce, nextWelfare] = await Promise.all([
          federationApi.overview(accessToken, federation.id),
          federationApi.cooperatives(accessToken, federation.id),
          federationApi.workforce(accessToken, federation.id),
          federationApi.welfare(accessToken, federation.id),
        ]);
        if (cancelled) return;
        setOverview(nextOverview);
        setCooperatives(nextCooperatives);
        setWorkforce(nextWorkforce);
        setWelfare(nextWelfare);
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) return <FederationLoading />;
  if (error)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => window.location.reload()}>Try again</Button>}
      />
    );
  if (!overview) {
    return (
      <GlassCard className="dashboard-placeholder">
        <EmptyState
          icon="grid"
          title="No federation workspace yet."
          description="A federation administrator workspace will appear here once your account is associated with one."
        />
      </GlassCard>
    );
  }

  return (
    <>
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Federation intelligence</p>
          <h1>{overview.name}</h1>
          <p>{overview.description || 'A clear, aggregate view of the cooperative network.'}</p>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard
          label="Active cooperatives"
          value={String(overview.activeCooperatives)}
          icon={<Icon name="building" />}
        />
        <StatCard
          label="Active workers"
          value={String(overview.activeWorkers)}
          tone="cyan"
          icon={<Icon name="users" />}
        />
        <StatCard
          label="Verified workers"
          value={String(overview.verifiedWorkers)}
          tone="emerald"
          icon={<Icon name="verify" />}
        />
        <StatCard
          label="Open demand"
          value={String(overview.openDemand)}
          tone="amber"
          icon={<Icon name="briefcase" />}
        />
      </div>
      <section className="dashboard-split">
        <GlassCard>
          <div className="card-heading">
            <div>
              <p>Cooperative directory</p>
              <h2>Network activity</h2>
            </div>
            <Icon name="building" />
          </div>
          {cooperatives.length ? (
            <div className="federation-list">
              {cooperatives.map((cooperative) => (
                <div className="federation-list__row" key={cooperative.id}>
                  <div>
                    <b>{cooperative.name}</b>
                    <span>
                      {cooperative.location || 'Location not provided'} ·{' '}
                      {cooperative.membershipStatus.toLowerCase()}
                    </span>
                  </div>
                  <strong>{cooperative.activeWorkers} workers</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="building"
              title="No member cooperatives"
              description="Approved federation members will appear here."
            />
          )}
        </GlassCard>
        <GlassCard>
          <div className="card-heading">
            <div>
              <p>Capacity and welfare</p>
              <h2>Where attention helps</h2>
            </div>
            <Icon name="sparkles" />
          </div>
          <div className="federation-metrics">
            <span>
              Available workforce <b>{workforce?.availableWorkers ?? 0}</b>
            </span>
            <span>
              Priority capacity <b>{workforce?.priorityCapacity ?? 0}</b>
            </span>
            <span>
              Welfare participation{' '}
              <b>{welfare?.participationRate ?? overview.welfareParticipation}%</b>
            </span>
            <span>
              Open claims <b>{welfare?.submittedClaims ?? 0}</b>
            </span>
          </div>
        </GlassCard>
      </section>
      <section className="studio-section">
        <div className="studio-section__head">
          <div>
            <p className="dashboard-overline">Skill capacity</p>
            <h2>Verified workforce by skill.</h2>
          </div>
        </div>
        <div className="federation-skill-grid">
          {workforce?.bySkill.slice(0, 8).map((skill) => (
            <GlassCard className="federation-skill" key={skill.id}>
              <span>{skill.category || 'General'}</span>
              <b>{skill.name}</b>
              <strong>{skill.verifiedWorkers}</strong>
              <small>verified workers</small>
            </GlassCard>
          ))}
        </div>
      </section>
    </>
  );
}

function FederationLoading() {
  return (
    <>
      <Skeleton className="dashboard-loading__title" />
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <Skeleton className="dashboard-loading__body" />
    </>
  );
}
