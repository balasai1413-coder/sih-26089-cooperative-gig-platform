'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingSpinner, Skeleton } from '@/components/ui/feedback';
import { Select, TextInput } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { cooperativeApi } from '@/lib/api/cooperative';
import { demandForecastingApi } from '@/lib/api/demand-forecasting';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  DemandForecastFilters,
  DemandForecastResponse,
  DemandLevel,
  ForecastResult,
} from '@/types/demand-forecasting';
import type { AdminSkill, SkillCategory } from '@/types/cooperative';

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function initialFilters(): DemandForecastFilters {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { forecastStart: toDateInput(start), forecastEnd: toDateInput(end), location: '' };
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sign in to view your cooperative forecast.';
    if (error.status === 403) return 'You do not have access to this cooperative forecast.';
    if (error.status === 400) return error.message || 'Check the forecast dates and filters.';
    return error.message;
  }
  return 'We could not load the demand forecast. Please try again.';
}

function levelTone(level: DemandLevel | null) {
  if (level === 'CRITICAL') return 'danger' as const;
  if (level === 'HIGH') return 'warning' as const;
  if (level === 'MEDIUM') return 'cyan' as const;
  return 'success' as const;
}

function displayNumber(value: number | null) {
  return value === null ? '—' : String(value);
}

function titleFor(result: ForecastResult, fallback: string) {
  return (
    result.dimensions.skill?.name ??
    result.dimensions.category?.name ??
    result.dimensions.location ??
    fallback
  );
}

export function DemandForecastingDashboard() {
  const { accessToken } = useAuth();
  const [forecast, setForecast] = useState<DemandForecastResponse | null>(null);
  const [filters, setFilters] = useState<DemandForecastFilters>(initialFilters);
  const [cooperativeId, setCooperativeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);

  const load = useCallback(
    async (nextFilters: DemandForecastFilters) => {
      if (!accessToken) return;
      setLoading(true);
      setError('');
      try {
        const cooperatives = await cooperativeApi.list(accessToken);
        const target = cooperatives[0];
        if (!target) {
          setCooperativeId('');
          setForecast(null);
          return;
        }
        setCooperativeId(target.id);
        const data = await demandForecastingApi.get(accessToken, target.id, nextFilters);
        setForecast(data);
      } catch (loadError) {
        setError(friendlyError(loadError));
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  useEffect(() => {
    if (!accessToken) return;
    void Promise.all([cooperativeApi.skills(accessToken), cooperativeApi.categories(accessToken)])
      .then(([skillData, categoryData]) => {
        setSkills(skillData.filter((skill) => skill.active));
        setCategories(categoryData.filter((category) => category.active));
      })
      // Filtering remains usable even if the optional catalog lookups fail.
      .catch(() => undefined);
  }, [accessToken]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      forecastStart: String(form.get('forecastStart') || ''),
      forecastEnd: String(form.get('forecastEnd') || ''),
      location: String(form.get('location') || '').trim(),
      skillId: String(form.get('skillId') || ''),
      categoryId: String(form.get('categoryId') || ''),
    };
    setFilters(next);
  }

  if (loading && !forecast) return <ForecastLoading />;
  if (error && !forecast)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load(filters)}>Try again</Button>}
      />
    );
  if (!cooperativeId && !loading)
    return (
      <GlassCard className="dashboard-placeholder">
        <EmptyState
          icon="building"
          title="No cooperative yet."
          description="Add a cooperative before reviewing demand forecasts."
        />
      </GlassCard>
    );
  if (!forecast) return null;

  const overview = forecast.overview;
  return (
    <div className="demand-forecast">
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">AI-ready demand forecasting</p>
          <h1>Plan the next wave of work.</h1>
          <p>
            A deterministic baseline from your cooperative’s real service history—not a trained ML
            model.
          </p>
        </div>
        <Badge tone={overview.status === 'READY' ? 'success' : 'warning'}>
          {overview.status === 'READY' ? 'Baseline ready' : overview.status.replaceAll('_', ' ')}
        </Badge>
      </div>

      <form className="demand-filter-bar" onSubmit={submitFilters}>
        <TextInput
          label="Forecast from"
          name="forecastStart"
          type="date"
          required
          defaultValue={filters.forecastStart}
        />
        <TextInput
          label="Forecast to"
          name="forecastEnd"
          type="date"
          required
          defaultValue={filters.forecastEnd}
        />
        <TextInput
          label="Area (optional)"
          name="location"
          placeholder="e.g. Sector 17"
          defaultValue={filters.location}
        />
        <Select label="Service (optional)" name="skillId" defaultValue={filters.skillId ?? ''}>
          <option value="">All services</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </Select>
        <Select
          label="Category (optional)"
          name="categoryId"
          defaultValue={filters.categoryId ?? ''}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <SecondaryButton icon="sparkles" type="submit" disabled={loading}>
          Update forecast
        </SecondaryButton>
      </form>

      {error ? (
        <p className="demand-forecast__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <LoadingSpinner label="Refreshing demand forecast" /> : null}

      {overview.status === 'READY' ? (
        <ReadyForecast forecast={forecast} />
      ) : (
        <UnavailableForecast forecast={forecast} />
      )}
    </div>
  );
}

function ReadyForecast({ forecast }: { forecast: DemandForecastResponse }) {
  const overview = forecast.overview;
  return (
    <>
      <div className="stat-grid demand-forecast__stats">
        <StatCard
          label="Predicted demand"
          value={displayNumber(overview.predictedDemand)}
          change={`${forecast.forecastPeriod.days}-day forecast`}
          tone="amber"
          icon={<Icon name="sparkles" />}
        />
        <StatCard
          label="Historical baseline"
          value={displayNumber(overview.historicalBaseline)}
          change={`${overview.dataSufficiency.historicalRequestCount} qualifying requests`}
          tone="cyan"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="Demand trend"
          value={overview.trend?.toLowerCase() ?? '—'}
          change="Compared with the prior 7 days"
          tone="emerald"
          icon={<Icon name="arrow-up-right" />}
        />
      </div>

      <section className="demand-forecast__hero-grid">
        <GlassCard className="demand-forecast__insight">
          <div className="card-heading">
            <div>
              <p>Upcoming demand</p>
              <h2>
                {forecast.forecastPeriod.startDate} → {forecast.forecastPeriod.endDate}
              </h2>
            </div>
            <Badge tone={levelTone(overview.demandLevel)}>{overview.demandLevel}</Badge>
          </div>
          <p>{overview.explanation}</p>
          <small>{overview.dataSufficiency.message}</small>
        </GlassCard>
        <GlassCard className="demand-forecast__method">
          <p className="dashboard-overline">Demand source</p>
          <h2>Only attributable work.</h2>
          <p>{forecast.source.description}</p>
          <small>Excluded: {forecast.source.excluded.join(', ')}.</small>
        </GlassCard>
      </section>

      <div className="demand-forecast__segments">
        <ForecastList
          title="High-demand skills"
          items={forecast.highDemandSkills}
          fallback="Skill"
        />
        <ForecastList
          title="High-demand categories"
          items={forecast.highDemandCategories}
          fallback="Category"
        />
        <ForecastList title="High-demand areas" items={forecast.highDemandAreas} fallback="Area" />
      </div>
    </>
  );
}

function ForecastList({
  title,
  items,
  fallback,
}: {
  title: string;
  items: ForecastResult[];
  fallback: string;
}) {
  const ready = items.filter((item) => item.status === 'READY').slice(0, 5);
  return (
    <GlassCard className="demand-forecast__list">
      <div className="card-heading">
        <div>
          <p>Allocation signals</p>
          <h2>{title}</h2>
        </div>
        <Icon name="zap" />
      </div>
      {ready.length ? (
        <div className="demand-forecast__rows">
          {ready.map((item) => (
            <div key={`${title}-${titleFor(item, fallback)}`}>
              <span>{titleFor(item, fallback)}</span>
              <b>{item.predictedDemand} requests</b>
              <Badge tone={levelTone(item.demandLevel)}>{item.demandLevel}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="demand-forecast__quiet">
          No segment has enough history for a reliable forecast yet.
        </p>
      )}
    </GlassCard>
  );
}

function UnavailableForecast({ forecast }: { forecast: DemandForecastResponse }) {
  const overview = forecast.overview;
  const noHistory = overview.status === 'NO_HISTORICAL_DATA';
  return (
    <GlassCard className="dashboard-placeholder demand-forecast__unavailable">
      <EmptyState
        icon={noHistory ? 'briefcase' : 'sparkles'}
        title={noHistory ? 'No attributable demand history yet.' : 'More history is needed.'}
        description={overview.dataSufficiency.message}
      />
      <p>{overview.explanation}</p>
      <small>
        {overview.dataSufficiency.historicalRequestCount} qualifying requests across{' '}
        {overview.dataSufficiency.historicalDays} historical days.
      </small>
    </GlassCard>
  );
}

function ForecastLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <Skeleton className="dashboard-loading__body" />
      <LoadingSpinner label="Loading demand forecast" />
    </div>
  );
}
