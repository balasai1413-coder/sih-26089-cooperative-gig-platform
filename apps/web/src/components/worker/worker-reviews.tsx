'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton, Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { workerApi } from '@/lib/api/worker';
import { useAuth } from '@/lib/auth/auth-context';
import type { Review } from '@/types/review';

function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'We could not complete that action. Please try again.';
}

function StarRating({ value }: { value: number }) {
  return (
    <div style={{ display: 'inline-flex', gap: '0.125rem', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color: star <= value ? '#f59e0b' : '#d1d5db',
            fontSize: '1.1rem',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function WorkerReviews() {
  const { accessToken } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await workerApi.reviews(accessToken);
      setReviews(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const averageRating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as Record<string, number>;
  for (const r of reviews) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
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

  if (error && !reviews.length) {
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Toast tone="error" message={error} onDismiss={() => setError('')} /> : null}

      <div className="worker-studio__topline">
        <div>
          <p className="dashboard-overline">Reviews & Reputation</p>
          <h1>What customers say about your work.</h1>
          <p>
            Reviews build trust. They are read-only and cannot be modified or removed by you.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Average rating"
          value={averageRating !== null ? String(averageRating) : '—'}
          change={reviews.length > 0 ? `${reviews.length} review${reviews.length > 1 ? 's' : ''}` : 'No reviews yet'}
          tone={averageRating !== null && averageRating >= 4 ? 'emerald' : averageRating !== null && averageRating >= 3 ? 'cyan' : 'amber'}
          icon={<Icon name="sparkles" />}
        />
        <StatCard
          label="Total reviews"
          value={String(reviews.length)}
          change="From completed bookings"
          icon={<Icon name="briefcase" />}
        />
        <StatCard
          label="5-star reviews"
          value={String(distribution['5'])}
          change={`${reviews.length ? Math.round((distribution['5'] / reviews.length) * 100) : 0}% of total`}
          tone="emerald"
          icon={<Icon name="verify" />}
        />
      </div>

      {reviews.length === 0 ? (
        <GlassCard className="dashboard-placeholder">
          <EmptyState
            icon="sparkles"
            title="No reviews yet."
            description="Complete more bookings to start building your reputation."
          />
        </GlassCard>
      ) : (
        <div className="member-list" role="list">
          {reviews.map((review) => (
            <GlassCard key={review.id} className="member-card" role="listitem">
              <div className="member-card__title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <StarRating value={review.rating} />
                  <span style={{ fontWeight: 600 }}>{review.rating}.0</span>
                </div>
                <Badge tone="success">
                  {new Date(review.createdAt).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                </Badge>
              </div>

              {review.comment ? (
                <p
                  style={{
                    fontSize: '0.95rem',
                    color: 'var(--text)',
                    marginTop: '0.5rem',
                    lineHeight: 1.5,
                  }}
                >
                  &ldquo;{review.comment}&rdquo;
                </p>
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  No comment provided.
                </p>
              )}

              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.5rem',
                }}
              >
                Customer review
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}
