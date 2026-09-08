'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  Skeleton,
  Toast,
} from '@/components/ui/feedback';
import { TextInput, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { cooperativeApi } from '@/lib/api/cooperative';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  CooperativeProfile,
  CooperativeSummary,
  UpdateCooperativePayload,
} from '@/types/cooperative';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not load that information. Please try again.';
}

export function CooperativeOverview() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<CooperativeProfile | null>(null);
  const [summary, setSummary] = useState<CooperativeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const list = await cooperativeApi.list(accessToken);
      const target = list[0];
      if (!target) {
        setProfile(null);
        setSummary(null);
        setLoading(false);
        return;
      }
      const profileData = await cooperativeApi.get(accessToken, target.id);
      setProfile(profileData);
      setSummary(target);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <OverviewLoading />;
  if (error && !profile)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  if (!profile) {
    return (
      <GlassCard className="dashboard-placeholder">
        <EmptyState
          icon="building"
          title="No cooperative yet."
          description="Create or join a cooperative to start building your collective profile."
        />
      </GlassCard>
    );
  }

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Cooperative profile</p>
          <h1>{profile.name}</h1>
          <p>
            {profile.description ||
              'Add a description to tell workers what your cooperative stands for.'}
          </p>
        </div>
        <SecondaryButton icon="plus" onClick={() => setEditing(true)}>
          Edit profile
        </SecondaryButton>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Active members"
          value={String(profile.memberCount)}
          icon={<Icon name="users" />}
        />
        <StatCard
          label="Verified skills"
          value={String(summary?.verifiedSkillCount ?? 0)}
          tone="emerald"
          icon={<Icon name="verify" />}
        />
        <StatCard
          label="Pending review"
          value={String(summary?.pendingVerificationCount ?? 0)}
          tone="amber"
          icon={<Icon name="briefcase" />}
        />
      </div>

      <section className="studio-section">
        <div className="studio-section__head">
          <div>
            <p className="dashboard-overline">About the collective</p>
            <h2>The details that matter.</h2>
          </div>
        </div>
        <div className="worker-detail-grid">
          <InfoCard
            icon="building"
            label="Registration"
            value={profile.registrationNo || 'Not provided'}
          />
          <InfoCard icon="grid" label="Location" value={profile.location || 'Not provided'} />
          <InfoCard
            icon="compass"
            label="Operating area"
            value={profile.operatingArea || 'Not provided'}
          />
          <InfoCard
            icon="message"
            label="Contact email"
            value={profile.contactEmail || 'Not provided'}
          />
          <InfoCard
            icon="user"
            label="Contact phone"
            value={profile.contactPhone || 'Not provided'}
          />
        </div>
      </section>

      <Modal open={editing} title="Edit cooperative profile" onClose={() => setEditing(false)}>
        <ProfileForm
          profile={profile}
          onSubmit={async (payload) => {
            if (!accessToken) return;
            try {
              const updated = await cooperativeApi.update(accessToken, profile.id, payload);
              setProfile(updated);
              setEditing(false);
              setNotice('Profile updated.');
            } catch (submitError) {
              setError(friendlyError(submitError));
            }
          }}
        />
      </Modal>
    </>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: 'building' | 'grid' | 'compass' | 'message' | 'user';
  label: string;
  value: string;
}) {
  return (
    <GlassCard className="worker-detail-card">
      <Icon name={icon} />
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
    </GlassCard>
  );
}

function ProfileForm({
  profile,
  onSubmit,
}: {
  profile: CooperativeProfile;
  onSubmit: (payload: UpdateCooperativePayload) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        name: String(form.get('name') ?? '') || undefined,
        description: String(form.get('description') || '') || null,
        location: String(form.get('location') || '') || null,
        operatingArea: String(form.get('operatingArea') || '') || null,
        contactEmail: String(form.get('contactEmail') || '') || null,
        contactPhone: String(form.get('contactPhone') || '') || null,
      });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <TextInput label="Cooperative name" name="name" required defaultValue={profile.name} />
      <Textarea label="Description" name="description" defaultValue={profile.description ?? ''} />
      <TextInput label="Location" name="location" defaultValue={profile.location ?? ''} />
      <TextInput
        label="Operating area"
        name="operatingArea"
        defaultValue={profile.operatingArea ?? ''}
      />
      <TextInput
        label="Contact email"
        name="contactEmail"
        type="email"
        defaultValue={profile.contactEmail ?? ''}
      />
      <TextInput
        label="Contact phone"
        name="contactPhone"
        defaultValue={profile.contactPhone ?? ''}
      />
      <Button type="submit" icon="check" disabled={submitting}>
        Save profile
      </Button>
    </form>
  );
}

function OverviewLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <div className="worker-detail-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <LoadingSpinner label="Loading cooperative profile" />
    </div>
  );
}
