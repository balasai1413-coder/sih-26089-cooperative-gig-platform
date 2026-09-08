'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  Skeleton,
  Toast,
} from '@/components/ui/feedback';
import { Select, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { workerApi } from '@/lib/api/worker';
import { useAuth } from '@/lib/auth/auth-context';
import type { VerificationMethod, VerificationRequest } from '@/types/worker';

const labelForMethod: Record<VerificationMethod, string> = {
  PRACTICAL_ASSESSMENT: 'Practical assessment',
  EXPERIENCE_EVIDENCE: 'Experience evidence',
  CERTIFICATE_EVIDENCE: 'Certificate evidence',
  ADMIN_REVIEW: 'Admin review',
};

const labelForEvidenceType: Record<string, string> = {
  PRACTICAL_EXPERIENCE: 'Practical experience',
  WORK_SAMPLE: 'Work sample',
  ASSESSMENT: 'Assessment',
  TRAINING: 'Training',
  CERTIFICATE: 'Certificate',
  EMPLOYER_OR_CLIENT: 'Employer or client reference',
  OTHER: 'Other',
};

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

/**
 * Cooperative admin verification queue. The backend resolves cooperative scope
 * from persisted admin relationships; the UI never supplies authorization data.
 */
export function CooperativeVerificationStudio() {
  const { status, accessToken } = useAuth();
  const [cooperatives, setCooperatives] = useState<
    { id: string; name: string; registrationNo: string | null }[]
  >([]);
  const [activeCooperativeId, setActiveCooperativeId] = useState<string>('');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState<VerificationRequest | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    setError('');
    try {
      const cooperatives = await workerApi.cooperatives(accessToken);
      setCooperatives(cooperatives);
      const target =
        cooperatives.find((item) => item.id === activeCooperativeId)?.id ??
        cooperatives[0]?.id ??
        '';
      setActiveCooperativeId(target);
      setRequests(target ? await workerApi.cooperativeRequests(accessToken, target) : []);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, activeCooperativeId]);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [load, status]);

  async function switchCooperative(cooperativeId: string) {
    if (!accessToken) return;
    setActiveCooperativeId(cooperativeId);
    setRefreshing(true);
    setError('');
    try {
      setRequests(await workerApi.cooperativeRequests(accessToken, cooperativeId));
    } catch (switchError) {
      setError(friendlyError(switchError));
    } finally {
      setRefreshing(false);
    }
  }

  async function review(decision: 'VERIFIED' | 'REJECTED', note: string) {
    if (!accessToken || !reviewing || !activeCooperativeId) return;
    setActing(true);
    setError('');
    try {
      await workerApi.reviewVerification(accessToken, activeCooperativeId, reviewing.id, {
        decision,
        note: note || undefined,
      });
      setReviewing(null);
      setNotice(
        decision === 'VERIFIED'
          ? 'Skill verified. The worker can see the decision immediately.'
          : 'Request rejected. The worker will see your reason.',
      );
      await load();
    } catch (reviewError) {
      setError(friendlyError(reviewError));
    } finally {
      setActing(false);
    }
  }

  if (status === 'loading' || (loading && !cooperatives.length)) return <StudioLoading />;
  if (status !== 'authenticated' || !accessToken) return null;
  if (!cooperatives.length) {
    return (
      <ErrorState
        description={error || 'No cooperatives are linked to this admin account yet.'}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  return (
    <section className="worker-studio">
      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Verification queue</p>
          <h1>Every verified skill earns its place.</h1>
          <p>
            Review the evidence behind each request. Only a deliberate human decision makes a skill
            verified.
          </p>
        </div>
        <div className="cooperative-switch">
          <Select
            label="Cooperative"
            value={activeCooperativeId}
            onChange={(event) => void switchCooperative(event.target.value)}
          >
            {cooperatives.map((cooperative) => (
              <option key={cooperative.id} value={cooperative.id}>
                {cooperative.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}

      <section className="studio-section">
        <div className="studio-section__head">
          <div>
            <p className="dashboard-overline">Pending review</p>
            <h2>
              {requests.length
                ? `${requests.length} request${requests.length === 1 ? '' : 's'} waiting.`
                : 'Nothing needs attention.'}
            </h2>
          </div>
          <SecondaryButton icon="zap" onClick={() => void load()} loading={refreshing}>
            Refresh
          </SecondaryButton>
        </div>
        {requests.length ? (
          <div className="review-queue">
            {requests.map((request) => (
              <GlassCard key={request.id} className="review-row">
                <div className="review-row__main">
                  <div className="review-row__identity">
                    <span className="review-row__avatar">
                      {(request.worker.fullName || 'W').slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3>{request.worker.fullName || 'Worker'}</h3>
                      <p>
                        {request.skill.name} · {request.skill.proficiency.toLowerCase()} ·{' '}
                        {request.skill.experienceYears} years practical experience
                      </p>
                    </div>
                  </div>
                  <Badge tone="warning">
                    {request.method ? labelForMethod[request.method] : 'Review request'}
                  </Badge>
                </div>
                {request.skill.experienceSummary ? (
                  <p className="review-row__summary">{request.skill.experienceSummary}</p>
                ) : null}
                <div className="review-row__detail">
                  <div>
                    <span>Evidence ({request.evidence.length})</span>
                    {request.evidence.length ? (
                      <ul>
                        {request.evidence.map((item) => (
                          <li key={item.id}>
                            <b>{labelForEvidenceType[item.type] ?? item.type}</b> —{' '}
                            {item.description}
                            {item.referenceUrl ? (
                              <a href={item.referenceUrl} target="_blank" rel="noreferrer">
                                {' '}
                                reference <Icon name="arrow-up-right" />
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No evidence attached.</p>
                    )}
                  </div>
                  <div>
                    <span>Certificates ({request.certificates.length})</span>
                    {request.certificates.length ? (
                      <ul>
                        {request.certificates.map((certificate) => (
                          <li key={certificate.id}>
                            <b>{certificate.title}</b>
                            {certificate.issuer ? ` — ${certificate.issuer}` : ''}
                            {certificate.referenceNo ? ` (${certificate.referenceNo})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No certificates supplied.</p>
                    )}
                  </div>
                </div>
                {request.note ? (
                  <p className="review-row__note">Worker note: {request.note}</p>
                ) : null}
                <div className="review-row__actions">
                  <Button icon="check" onClick={() => setReviewing(request)}>
                    Review decision
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="verify"
            title="Your review queue is clear."
            description="When workers request skill verification, their evidence and certificates will appear here for a thoughtful review."
          />
        )}
      </section>

      <Modal
        open={Boolean(reviewing)}
        title={reviewing ? `Review ${reviewing.skill.name}` : 'Review'}
        onClose={() => setReviewing(null)}
      >
        {reviewing ? (
          <ReviewForm
            request={reviewing}
            acting={acting}
            onSubmit={(decision, note) => void review(decision, note)}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function ReviewForm({
  request,
  acting,
  onSubmit,
}: {
  request: VerificationRequest;
  acting: boolean;
  onSubmit: (decision: 'VERIFIED' | 'REJECTED', note: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision =
      submitter?.getAttribute('data-decision') === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
    onSubmit(decision, String(form.get('note') || ''));
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      <p className="modal__description">
        {request.worker.fullName || 'The worker'} requests verification of{' '}
        <b>{request.skill.name}</b> ({request.skill.proficiency.toLowerCase()},{' '}
        {request.skill.experienceYears} years practical experience) via{' '}
        {request.method ? labelForMethod[request.method].toLowerCase() : 'review'}. Evidence
        attached: {request.evidence.length}. Certificates: {request.certificates.length}.
      </p>
      <Textarea
        label="Review note (required when rejecting)"
        name="note"
        hint="Explain the assessment outcome so the worker knows what to improve."
      />
      <div className="modal__actions">
        <SecondaryButton type="submit" icon="close" data-decision="REJECTED" disabled={acting}>
          Reject
        </SecondaryButton>
        <Button type="submit" icon="check" data-decision="VERIFIED" disabled={acting}>
          Verify skill
        </Button>
      </div>
    </form>
  );
}

function StudioLoading() {
  return (
    <div className="worker-studio worker-studio--loading">
      <Skeleton className="dashboard-loading__title" />
      <Skeleton className="worker-studio--loading__hero" />
      <div className="review-queue">
        <Skeleton />
        <Skeleton />
      </div>
      <LoadingSpinner label="Loading the verification queue" />
    </div>
  );
}
