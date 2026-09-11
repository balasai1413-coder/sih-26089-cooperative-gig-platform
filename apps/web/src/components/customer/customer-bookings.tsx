'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Modal, Skeleton, Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { customerApi, type Booking, type BookingStatus } from '@/lib/api/customer';
import { useAuth } from '@/lib/auth/auth-context';

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

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: readonly ? 'default' : 'pointer',
            fontSize: '1.5rem',
            color: star <= value ? '#f59e0b' : '#d1d5db',
            padding: 0,
            lineHeight: 1,
          }}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function CustomerBookings() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelNotes, setCancelNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Review state
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await customerApi.bookings(accessToken);
      setBookings(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancelBooking() {
    if (!accessToken || !cancellingBooking) return;
    setBusy(true);
    try {
      const updated = await customerApi.cancelBooking(
        accessToken,
        cancellingBooking.id,
        cancelNotes || undefined,
      );
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setCancellingBooking(null);
      setCancelNotes('');
      setNotice('Booking has been cancelled.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReview() {
    if (!accessToken || !reviewingBooking || reviewRating === 0) return;
    setReviewBusy(true);
    try {
      const updated = await customerApi.createReview(accessToken, reviewingBooking.id, {
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === updated.bookingId
            ? {
                ...b,
                review: {
                  id: updated.id,
                  rating: updated.rating,
                  comment: updated.comment,
                },
              }
            : b,
        ),
      );
      setReviewingBooking(null);
      setReviewRating(0);
      setReviewComment('');
      setNotice('Review submitted. Thank you!');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setReviewBusy(false);
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

  if (error && !bookings.length) {
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  const activeCount = bookings.filter((b) =>
    ['PENDING_WORKER_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status),
  ).length;

  const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}

      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">My Bookings</p>
          <h1>Track your confirmed and ongoing services.</h1>
          <p>
            Monitor worker assignment, review scheduled service dates, and manage active bookings.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total bookings"
          value={String(bookings.length)}
          change="All bookings across time"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="Active assignments"
          value={String(activeCount)}
          change="Pending, accepted, or in progress"
          tone="cyan"
          icon={<Icon name="compass" />}
        />
        <StatCard
          label="Completed services"
          value={String(completedCount)}
          change="Successfully delivered"
          tone="emerald"
          icon={<Icon name="verify" />}
        />
      </div>

      {bookings.length === 0 ? (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="briefcase"
            title="No bookings yet."
            description="When you match and assign an eligible worker to your service request, the booking will appear here."
          />
        </GlassCard>
      ) : (
        <div className="member-list" role="list">
          {bookings.map((booking) => {
            const canCancel =
              booking.status === 'PENDING_WORKER_ACCEPTANCE' || booking.status === 'ACCEPTED';
            const isCompleted = booking.status === 'COMPLETED';
            const hasReview = Boolean(booking.review);

            return (
              <GlassCard key={booking.id} className="member-card" role="listitem">
                <div className="member-card__title">
                  <strong>{booking.serviceRequest.title}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge tone={statusTone[booking.status]}>{booking.status}</Badge>
                    {booking.serviceRequest.priority === 'EMERGENCY' ? (
                      <Badge tone="danger">EMERGENCY</Badge>
                    ) : (
                      <Badge tone="cyan">NORMAL</Badge>
                    )}
                  </div>
                </div>

                <p className="member-card__meta">
                  Assigned Worker: <strong>{booking.worker.fullName ?? 'Worker'}</strong>
                  {booking.worker.cooperative ? ` (${booking.worker.cooperative.name})` : ''}
                  {booking.serviceRequest.skill ? ` · ${booking.serviceRequest.skill.name}` : ''}
                </p>

                <p className="member-card__meta">
                  Scheduled for: <strong>{formatDate(booking.scheduledAt)}</strong>
                  {booking.serviceRequest.location
                    ? ` · Location: ${booking.serviceRequest.location}`
                    : ''}
                </p>

                {booking.startedAt ? (
                  <p className="member-card__meta">
                    Service started: {formatDate(booking.startedAt)}
                  </p>
                ) : null}

                {booking.completedAt ? (
                  <p className="member-card__meta">
                    Service completed: {formatDate(booking.completedAt)}
                  </p>
                ) : null}

                {booking.customerNotes ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <em>Your notes:</em> {booking.customerNotes}
                  </p>
                ) : null}

                {booking.workerNotes ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <em>Worker notes:</em> {booking.workerNotes}
                  </p>
                ) : null}

                {hasReview ? (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'var(--surface-muted)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <StarRating value={booking.review!.rating} readonly />
                      <span style={{ fontWeight: 600 }}>{booking.review!.rating}.0</span>
                    </div>
                    {booking.review!.comment ? (
                      <p
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                        }}
                      >
                        &ldquo;{booking.review!.comment}&rdquo;
                      </p>
                    ) : null}
                  </div>
                ) : isCompleted ? (
                  <div className="member-card__actions" style={{ marginTop: '0.75rem' }}>
                    <Button size="sm" onClick={() => setReviewingBooking(booking)}>
                      Rate & Review
                    </Button>
                  </div>
                ) : null}

                {canCancel ? (
                  <div className="member-card__actions" style={{ marginTop: '0.75rem' }}>
                    <SecondaryButton size="sm" onClick={() => setCancellingBooking(booking)}>
                      Cancel booking
                    </SecondaryButton>
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      )}

      {cancellingBooking ? (
        <Modal
          open={Boolean(cancellingBooking)}
          title="Cancel Booking"
          onClose={() => setCancellingBooking(null)}
        >
          <div className="studio-form">
            <p>
              Are you sure you want to cancel the booking for &ldquo;
              <strong>{cancellingBooking.serviceRequest.title}</strong>&rdquo; with{' '}
              <strong>{cancellingBooking.worker.fullName ?? 'Worker'}</strong>?
            </p>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="field__label">Reason for cancellation (optional)</span>
              <textarea
                className="field__control textarea-control"
                rows={3}
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Let the worker know why you are cancelling..."
                maxLength={1000}
              />
            </label>

            <div className="studio-form__actions" style={{ marginTop: '1.5rem' }}>
              <SecondaryButton onClick={() => setCancellingBooking(null)}>
                Keep Booking
              </SecondaryButton>
              <Button disabled={busy} onClick={() => void handleCancelBooking()}>
                {busy ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {reviewingBooking ? (
        <Modal
          open={Boolean(reviewingBooking)}
          title="Rate & Review"
          onClose={() => {
            setReviewingBooking(null);
            setReviewRating(0);
            setReviewComment('');
          }}
        >
          <div className="studio-form">
            <p>
              How was your experience with{' '}
              <strong>{reviewingBooking.worker.fullName ?? 'Worker'}</strong>?
            </p>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="field__label">Rating</span>
              <div style={{ marginTop: '0.5rem' }}>
                <StarRating value={reviewRating} onChange={setReviewRating} />
              </div>
              {reviewRating === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Select a rating from 1 to 5
                </span>
              ) : null}
            </label>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span className="field__label">Comment (optional)</span>
              <textarea
                className="field__control textarea-control"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details about your experience..."
                maxLength={1000}
              />
            </label>

            <div className="studio-form__actions" style={{ marginTop: '1.5rem' }}>
              <SecondaryButton
                onClick={() => {
                  setReviewingBooking(null);
                  setReviewRating(0);
                  setReviewComment('');
                }}
              >
                Cancel
              </SecondaryButton>
              <Button
                disabled={reviewBusy || reviewRating === 0}
                onClick={() => void handleSubmitReview()}
              >
                {reviewBusy ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
