'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Modal, Skeleton, Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { workerApi } from '@/lib/api/worker';
import { useAuth } from '@/lib/auth/auth-context';
import type { Booking, BookingStatus } from '@/types/booking';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

const statusTone: Record<BookingStatus, 'cyan' | 'warning' | 'success' | 'danger'> = {
  PENDING_WORKER_ACCEPTANCE: 'warning',
  ACCEPTED: 'cyan',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
};

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function WorkerAssignments() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reject modal state
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Complete modal state
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await workerApi.bookings(accessToken);
      setAssignments(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept(bookingId: string) {
    if (!accessToken) return;
    setBusyId(bookingId);
    try {
      const updated = await workerApi.acceptBooking(accessToken, bookingId);
      setAssignments((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setNotice('Assignment accepted! You can start service when ready.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!accessToken || !rejectingBooking) return;
    setBusyId(rejectingBooking.id);
    try {
      const updated = await workerApi.rejectBooking(
        accessToken,
        rejectingBooking.id,
        rejectNote || undefined,
      );
      setAssignments((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setRejectingBooking(null);
      setRejectNote('');
      setNotice('Assignment rejected.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleStart(bookingId: string) {
    if (!accessToken) return;
    setBusyId(bookingId);
    try {
      const updated = await workerApi.startBooking(accessToken, bookingId);
      setAssignments((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setNotice('Service marked as IN PROGRESS.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete() {
    if (!accessToken || !completingBooking) return;
    setBusyId(completingBooking.id);
    try {
      const updated = await workerApi.completeBooking(
        accessToken,
        completingBooking.id,
        completeNote || undefined,
      );
      setAssignments((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setCompletingBooking(null);
      setCompleteNote('');
      setNotice('Service marked as COMPLETED! Great work.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (error && !assignments.length) {
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  const pendingCount = assignments.filter(
    (b) => b.status === 'PENDING_WORKER_ACCEPTANCE',
  ).length;
  const inProgressCount = assignments.filter((b) => b.status === 'IN_PROGRESS').length;
  const completedCount = assignments.filter((b) => b.status === 'COMPLETED').length;

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}

      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">My Assignments</p>
          <h1>Review, accept, and manage your booked services.</h1>
          <p>
            When customers request your verified skills, their bookings arrive here for your review.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Pending requests"
          value={String(pendingCount)}
          change="Awaiting your response"
          tone="cyan"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="In progress"
          value={String(inProgressCount)}
          change="Currently being served"
          tone="emerald"
          icon={<Icon name="zap" />}
        />
        <StatCard
          label="Completed"
          value={String(completedCount)}
          change="Finished services"
          icon={<Icon name="verify" />}
        />
      </div>

      {assignments.length === 0 ? (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="briefcase"
            title="No assignments yet."
            description="When customers select you for a service request, assignments will appear here."
          />
        </GlassCard>
      ) : (
        <div className="member-list" role="list">
          {assignments.map((booking) => {
            const isPending = booking.status === 'PENDING_WORKER_ACCEPTANCE';
            const isAccepted = booking.status === 'ACCEPTED';
            const isInProgress = booking.status === 'IN_PROGRESS';
            const isBusy = busyId === booking.id;

            return (
              <GlassCard key={booking.id} className="member-card" role="listitem">
                <div className="member-card__title">
                  <strong>{booking.serviceRequest.title}</strong>
                  <Badge tone={statusTone[booking.status]}>{booking.status}</Badge>
                </div>

                <p className="member-card__meta">
                  Skill requested: <strong>{booking.serviceRequest.skill?.name ?? 'General'}</strong>
                  {booking.serviceRequest.location ? ` · Location: ${booking.serviceRequest.location}` : ''}
                </p>

                <p className="member-card__meta">
                  Scheduled time: <strong>{formatDate(booking.scheduledAt)}</strong>
                </p>

                {booking.serviceRequest.description ? (
                  <p style={{ marginTop: '0.5rem' }}>{booking.serviceRequest.description}</p>
                ) : null}

                {booking.customerNotes ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <em>Customer notes:</em> {booking.customerNotes}
                  </p>
                ) : null}

                {booking.workerNotes ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <em>Your notes:</em> {booking.workerNotes}
                  </p>
                ) : null}

                {/* Actions strictly based on status */}
                <div className="member-card__actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {isPending ? (
                    <>
                      <Button
                        size="sm"
                        disabled={isBusy}
                        icon="verify"
                        onClick={() => void handleAccept(booking.id)}
                      >
                        {isBusy ? 'Accepting...' : 'Accept Assignment'}
                      </Button>
                      <SecondaryButton
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setRejectingBooking(booking)}
                      >
                        Reject
                      </SecondaryButton>
                    </>
                  ) : null}

                  {isAccepted ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      icon="zap"
                      onClick={() => void handleStart(booking.id)}
                    >
                      {isBusy ? 'Starting...' : 'Start Service'}
                    </Button>
                  ) : null}

                  {isInProgress ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      icon="verify"
                      onClick={() => setCompletingBooking(booking)}
                    >
                      Complete Service
                    </Button>
                  ) : null}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Reject assignment modal */}
      {rejectingBooking ? (
        <Modal
          open={Boolean(rejectingBooking)}
          title="Reject Assignment"
          onClose={() => setRejectingBooking(null)}
        >
          <div className="studio-form">
            <p>
              Are you sure you want to decline &ldquo;
              <strong>{rejectingBooking.serviceRequest.title}</strong>&rdquo;? The customer will be able to select another worker.
            </p>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="field__label">Reason for rejection (optional)</span>
              <textarea
                className="field__control textarea-control"
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. Unavailable at the scheduled time..."
                maxLength={1000}
              />
            </label>

            <div className="studio-form__actions" style={{ marginTop: '1.5rem' }}>
              <SecondaryButton onClick={() => setRejectingBooking(null)}>
                Cancel
              </SecondaryButton>
              <Button disabled={Boolean(busyId)} onClick={() => void handleReject()}>
                {busyId ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Complete service modal */}
      {completingBooking ? (
        <Modal
          open={Boolean(completingBooking)}
          title="Complete Service"
          onClose={() => setCompletingBooking(null)}
        >
          <div className="studio-form">
            <p>
              Confirm completion of &ldquo;
              <strong>{completingBooking.serviceRequest.title}</strong>&rdquo;?
            </p>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="field__label">Completion notes / Work summary (optional)</span>
              <textarea
                className="field__control textarea-control"
                rows={3}
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder="Summary of work completed, parts used, or advice for the customer..."
                maxLength={1000}
              />
            </label>

            <div className="studio-form__actions" style={{ marginTop: '1.5rem' }}>
              <SecondaryButton onClick={() => setCompletingBooking(null)}>
                Back
              </SecondaryButton>
              <Button disabled={Boolean(busyId)} icon="verify" onClick={() => void handleComplete()}>
                {busyId ? 'Completing...' : 'Mark as Completed'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

