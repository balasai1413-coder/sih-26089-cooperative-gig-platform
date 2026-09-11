'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
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
import { Select, TextInput, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { customerApi, type CatalogSkill } from '@/lib/api/customer';
import { FindWorkersButton } from '@/components/customer/worker-matches';
import { useAuth } from '@/lib/auth/auth-context';
import type { ServiceRequest, ServiceRequestStatus } from '@/types/customer';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

const statusTone: Record<ServiceRequestStatus, 'cyan' | 'warning' | 'success' | 'danger'> = {
  OPEN: 'cyan',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
  CANCELLED: 'danger',
};

function formatDate(value: string | null) {
  if (!value) return 'Flexible';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function CustomerRequests() {
  const { accessToken } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [skills, setSkills] = useState<CatalogSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [requestsData, skillsData] = await Promise.all([
        customerApi.serviceRequests(accessToken),
        customerApi.skillsCatalog(accessToken),
      ]);
      setRequests(requestsData);
      setSkills(skillsData);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      const created = await customerApi.createServiceRequest(accessToken, {
        skillId: String(form.get('skillId')),
        title: String(form.get('title')),
        description: String(form.get('description') || '') || null,
        location: String(form.get('location') || '') || null,
        preferredDateTime: String(form.get('preferredDateTime') || '') || null,
        priority: (String(form.get('priority') || 'NORMAL') as 'NORMAL' | 'EMERGENCY') || 'NORMAL',
      });
      setRequests((prev) => [created, ...prev]);
      setCreating(false);
      setNotice('Request created. It is now open for matching.');
    } catch (submitError) {
      setFormError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      const updated = await customerApi.updateServiceRequest(accessToken, editing.id, {
        title: String(form.get('title')),
        description: String(form.get('description') || '') || null,
        location: String(form.get('location') || '') || null,
        preferredDateTime: String(form.get('preferredDateTime') || '') || null,
        priority: (String(form.get('priority') || 'NORMAL') as 'NORMAL' | 'EMERGENCY') || 'NORMAL',
      });
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditing(null);
      setNotice('Request updated.');
    } catch (submitError) {
      setFormError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(request: ServiceRequest) {
    if (!accessToken) return;
    try {
      const cancelled = await customerApi.cancelServiceRequest(accessToken, request.id);
      setRequests((prev) => prev.map((r) => (r.id === cancelled.id ? cancelled : r)));
      setNotice('Request cancelled.');
    } catch (cancelError) {
      setError(friendlyError(cancelError));
    }
  }

  if (loading)
    return (
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  if (error && !requests.length)
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );

  const openCount = requests.filter((r) => r.status === 'OPEN').length;

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}

      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">My requests</p>
          <h1>Describe the work. The rest follows.</h1>
          <p>
            Each request captures the skill you need, where you need it, and when. Matching comes
            next.
          </p>
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>
          New request
        </Button>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total requests"
          value={String(requests.length)}
          change="Everything you have asked for"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="Open requests"
          value={String(openCount)}
          change="Waiting to be matched"
          tone="cyan"
          icon={<Icon name="compass" />}
        />
        <StatCard
          label="Closed requests"
          value={String(requests.filter((r) => r.status === 'CLOSED').length)}
          change="Completed with care"
          tone="emerald"
          icon={<Icon name="verify" />}
        />
      </div>

      {requests.length === 0 ? (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="briefcase"
            title="No requests yet."
            description="Create your first service request and it will appear here."
          />
        </GlassCard>
      ) : (
        <div className="member-list" role="list">
          {requests.map((request) => (
            <GlassCard key={request.id} className="member-card" role="listitem">
              <div className="member-card__title">
                <strong>{request.title}</strong>
                <Badge tone={statusTone[request.status]}>{request.status}</Badge>
                {request.priority === 'EMERGENCY' ? (
                  <Badge tone="danger">EMERGENCY</Badge>
                ) : (
                  <Badge tone="cyan">NORMAL</Badge>
                )}
              </div>
              <p className="member-card__meta">
                {request.skill ? request.skill.name : 'Skill no longer listed'}
                {request.location ? ` · ${request.location}` : ''}
              </p>
              <p className="member-card__meta">
                Preferred: {formatDate(request.preferredDateTime)}
              </p>
              {request.description ? <p>{request.description}</p> : null}
              {request.status === 'OPEN' ? (
                <div className="member-card__actions">
                  <FindWorkersButton
                    requestId={request.id}
                    requestStatus={request.status}
                    onBookingCreated={() => void load()}
                  />
                  <SecondaryButton size="sm" onClick={() => setEditing(request)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton size="sm" onClick={() => void cancelRequest(request)}>
                    Cancel request
                  </SecondaryButton>
                </div>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}

      {creating ? (
        <Modal open title="New service request" onClose={() => setCreating(false)}>
          <RequestForm
            skills={skills}
            busy={busy}
            error={formError}
            submitLabel="Create request"
            onSubmit={submitCreate}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open title="Edit request" onClose={() => setEditing(null)}>
          <RequestForm
            skills={skills}
            busy={busy}
            error={formError}
            submitLabel="Save changes"
            request={editing}
            onSubmit={submitEdit}
          />
        </Modal>
      ) : null}
    </>
  );
}

function RequestForm({
  skills,
  busy,
  error,
  submitLabel,
  request,
  onSubmit,
}: {
  skills: CatalogSkill[];
  busy: boolean;
  error: string;
  submitLabel: string;
  request?: ServiceRequest;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="studio-form" onSubmit={onSubmit}>
      <Select
        label="Required skill"
        name="skillId"
        defaultValue={request?.skill?.id ?? ''}
        required
        disabled={Boolean(request)}
      >
        <option value="" disabled>
          Choose a skill
        </option>
        {skills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name}
          </option>
        ))}
      </Select>
      <TextInput
        label="Title"
        name="title"
        defaultValue={request?.title ?? ''}
        placeholder="e.g. Fix a leaking kitchen tap"
        required
        maxLength={200}
      />
      <Textarea
        label="Description"
        name="description"
        defaultValue={request?.description ?? ''}
        placeholder="Anything a worker should know before arriving"
        maxLength={2000}
      />
      <TextInput
        label="Location"
        name="location"
        defaultValue={request?.location ?? ''}
        placeholder="Area, landmark, or address hint"
        maxLength={300}
      />
      <TextInput
        label="Preferred date and time"
        name="preferredDateTime"
        type="datetime-local"
        defaultValue={request?.preferredDateTime ? request.preferredDateTime.slice(0, 16) : ''}
      />
      <Select
        label="Priority"
        name="priority"
        defaultValue={request?.priority ?? 'NORMAL'}
      >
        <option value="NORMAL">Normal Service</option>
        <option value="EMERGENCY">Emergency Service</option>
      </Select>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="studio-form__actions">
        <Button type="submit" disabled={busy}>
          {busy ? <LoadingSpinner /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}
