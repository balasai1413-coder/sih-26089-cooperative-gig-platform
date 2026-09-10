'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Modal, Skeleton, Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { customerApi } from '@/lib/api/customer';
import { useAuth } from '@/lib/auth/auth-context';
import type { WorkerMatch } from '@/types/customer';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

function scoreTone(score: number): 'cyan' | 'success' | 'violet' | 'warning' {
  if (score >= 75) return 'success';
  if (score >= 60) return 'cyan';
  if (score >= 40) return 'violet';
  return 'warning';
}

function proficiencyTone(proficiency: string): 'cyan' | 'success' | 'violet' | 'warning' {
  switch (proficiency) {
    case 'EXPERT':
      return 'success';
    case 'ADVANCED':
      return 'cyan';
    case 'INTERMEDIATE':
      return 'violet';
    default:
      return 'warning';
  }
}

function WorkerCard({
  match,
  onSelect,
}: {
  match: WorkerMatch;
  onSelect: (match: WorkerMatch) => void;
}) {
  return (
    <GlassCard className="match-card" role="listitem">
      <div className="match-card__head">
        <div className="match-card__identity">
          <span className="match-card__avatar">
            <Icon name="user" />
          </span>
          <div>
            <strong>{match.fullName ?? 'Worker'}</strong>
            <p className="match-card__skill">{match.skill.name}</p>
          </div>
        </div>
        <div className="match-card__score">
          <span className="match-card__score-label">Score</span>
          <Badge tone={scoreTone(match.score)}>{match.score}</Badge>
        </div>
      </div>

      <div className="match-card__facts">
        <span>
          <Icon name="shield" />
          <Badge tone={proficiencyTone(match.proficiency)}>{match.proficiency}</Badge>
        </span>
        <span>
          <Icon name="briefcase" />
          {match.experienceYears} yr
        </span>
        {match.cooperative ? (
          <span>
            <Icon name="building" />
            {match.cooperative.name}
          </span>
        ) : null}
        {match.distanceKm !== null ? (
          <span>
            <Icon name="compass" />
            {match.distanceKm} km
          </span>
        ) : null}
        {match.location ? (
          <span>
            <Icon name="compass" />
            {match.location}
          </span>
        ) : null}
      </div>

      <div className="match-card__reasons">
        <p className="match-card__reasons-label">Why this match</p>
        <ul>
          {match.matchReasons.map((reason) => (
            <li key={reason}>
              <Icon name="check" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" icon="verify" onClick={() => onSelect(match)}>
          Select / Book worker
        </Button>
      </div>
    </GlassCard>
  );
}

export function WorkerMatches({
  requestId,
  onBookingSuccess,
}: {
  requestId: string;
  onBookingSuccess?: () => void;
}) {
  const { accessToken } = useAuth();
  const [matches, setMatches] = useState<WorkerMatch[] | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerMatch | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [createdBookingStatus, setCreatedBookingStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await customerApi.findMatches(accessToken, requestId);
      setMatches(data);
    } catch (loadError) {
      setMatches(null);
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConfirmBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken || !selectedWorker) return;
    setBookingBusy(true);
    setBookingError('');

    const formData = new FormData(e.currentTarget);
    const scheduledAt = formData.get('scheduledAt') ? String(formData.get('scheduledAt')) : null;
    const customerNotes = formData.get('customerNotes')
      ? String(formData.get('customerNotes'))
      : null;

    try {
      const booking = await customerApi.createBooking(accessToken, requestId, {
        workerId: selectedWorker.workerId,
        cooperativeId: selectedWorker.cooperative?.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        customerNotes,
      });

      setNotice(
        `Booking created with ${selectedWorker.fullName ?? 'worker'}! Status: ${booking.status}`,
      );
      setCreatedBookingStatus(booking.status);
      setSelectedWorker(null);
      onBookingSuccess?.();
    } catch (err) {
      setBookingError(friendlyError(err));
    } finally {
      setBookingBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="match-grid">
        <Skeleton className="match-skeleton" />
        <Skeleton className="match-skeleton" />
        <Skeleton className="match-skeleton" />
      </div>
    );
  }

  if (error && !matches) {
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  if (matches && matches.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="No eligible workers yet"
        description="We could not find any verified workers for this request at the moment. Adjust the request or check back later."
      />
    );
  }

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}

      {createdBookingStatus ? (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
          }}
        >
          <strong>Active Booking Status: </strong>
          <Badge tone="cyan">{createdBookingStatus}</Badge>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Your booking has been submitted. The worker will review and accept or reject the
            assignment.
          </p>
        </div>
      ) : null}

      <div className="match-grid" role="list">
        {matches?.map((match) => (
          <WorkerCard
            key={match.workerId}
            match={match}
            onSelect={(worker) => {
              setBookingError('');
              setSelectedWorker(worker);
            }}
          />
        ))}
      </div>

      {selectedWorker ? (
        <Modal
          open={Boolean(selectedWorker)}
          title={`Book ${selectedWorker.fullName ?? 'Worker'}`}
          onClose={() => setSelectedWorker(null)}
        >
          <form className="studio-form" onSubmit={handleConfirmBooking}>
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '6px',
              }}
            >
              <p>
                <strong>Verified Skill:</strong> {selectedWorker.skill.name} (
                {selectedWorker.proficiency})
              </p>
              <p>
                <strong>Experience:</strong> {selectedWorker.experienceYears} years
              </p>
              {selectedWorker.cooperative ? (
                <p>
                  <strong>Cooperative:</strong> {selectedWorker.cooperative.name}
                </p>
              ) : null}
              <p>
                <strong>Match Score:</strong> {selectedWorker.score}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className="field">
                <span className="field__label">Scheduled Date & Time</span>
                <input type="datetime-local" name="scheduledAt" className="field__control" />
              </label>

              <label className="field">
                <span className="field__label">Customer Notes / Instructions (optional)</span>
                <textarea
                  name="customerNotes"
                  className="field__control textarea-control"
                  rows={3}
                  maxLength={1000}
                  placeholder="Provide any details or specific instructions for the worker..."
                />
              </label>
            </div>

            {bookingError ? (
              <p className="form-error" style={{ marginTop: '0.75rem' }}>
                {bookingError}
              </p>
            ) : null}

            <div className="studio-form__actions" style={{ marginTop: '1.25rem' }}>
              <SecondaryButton type="button" onClick={() => setSelectedWorker(null)}>
                Cancel
              </SecondaryButton>
              <Button type="submit" disabled={bookingBusy} icon="verify">
                {bookingBusy ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function FindWorkersButton({
  requestId,
  requestStatus,
  onBookingCreated,
}: {
  requestId: string;
  requestStatus: string;
  onBookingCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const disabled = requestStatus !== 'OPEN';

  return (
    <>
      <SecondaryButton
        size="sm"
        disabled={disabled}
        title={disabled ? 'Only OPEN requests can be matched' : 'Find eligible workers'}
        onClick={() => setOpen(true)}
      >
        <Icon name="search" /> Find workers
      </SecondaryButton>
      <Modal open={open} title="Eligible workers" onClose={() => setOpen(false)}>
        <p className="modal__description">
          Workers are shown only when they hold a verified skill, an active cooperative membership,
          and are available. Matching is deterministic and explainable.
        </p>
        <div className="match-modal__body">
          <WorkerMatches
            requestId={requestId}
            onBookingSuccess={() => {
              onBookingCreated?.();
            }}
          />
        </div>
      </Modal>
    </>
  );
}
