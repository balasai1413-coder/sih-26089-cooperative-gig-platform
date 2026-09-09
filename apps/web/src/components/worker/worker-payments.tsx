'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton, Toast } from '@/components/ui/feedback';
import { workerPaymentsApi } from '@/lib/api/payments';
import { useAuth } from '@/lib/auth/auth-context';
import type { Payment, PaymentStatus } from '@/types/payment';

const tone: Record<PaymentStatus, 'cyan' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'cyan',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'cyan',
};

/**
 * Step 9 — worker payment visibility is intentionally limited: amount, status
 * and invoice number only. No customer PII, no provider identifiers, and no
 * modification actions are exposed to workers.
 */
export function WorkerPayments() {
  const { accessToken } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      setPayments(await workerPaymentsApi.payments(accessToken));
    } catch {
      setError('We could not load your payments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (error && !payments.length) {
    return (
      <ErrorState
        description={error}
        retry={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }

  const earned = payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      {notice ? <Toast message={notice} onDismiss={() => setNotice('')} /> : null}
      <div className="stat-grid">
        <StatCard label="Payments" value={String(payments.length)} />
        <StatCard label="Collected" value={`₹${(earned / 100).toFixed(2)}`} />
      </div>
      <section style={{ marginTop: '1.5rem' }}>
        {payments.length === 0 ? (
          <EmptyState
            icon="verify"
            title="No payments yet"
            description="Payments for your completed services will appear here."
          />
        ) : (
          payments.map((payment) => (
            <GlassCard key={payment.id} className="member-card">
              <p className="member-card__meta">
                <strong>₹{(payment.amount / 100).toFixed(2)}</strong> ·{' '}
                <Badge tone={tone[payment.status]}>{payment.status}</Badge>
                {payment.invoice ? ` · Invoice ${payment.invoice.invoiceNumber}` : ''}
              </p>
            </GlassCard>
          ))
        )}
      </section>
    </>
  );
}
