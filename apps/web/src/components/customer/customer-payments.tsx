'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, SecondaryButton } from '@/components/ui/button';
import { GlassCard, StatCard } from '@/components/ui/card';
import { EmptyState, ErrorState, Modal, Skeleton, Toast } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/client';
import { customerApi, type Booking } from '@/lib/api/customer';
import { paymentsApi } from '@/lib/api/payments';
import { useAuth } from '@/lib/auth/auth-context';
import type { Invoice, Payment, PaymentOrder, PaymentStatus } from '@/types/payment';

const tone: Record<PaymentStatus, 'cyan' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'cyan',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'cyan',
};

function money(minor: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100);
}

function friendly(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/** Loads the Razorpay browser checkout script once (public, no secrets). */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ('Razorpay' in window) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CustomerPayments() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payBooking, setPayBooking] = useState<Booking | null>(null);
  const [paying, setPaying] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [b, p, i] = await Promise.all([
        customerApi.bookings(accessToken),
        paymentsApi.payments(accessToken),
        paymentsApi.invoices(accessToken),
      ]);
      setBookings(b);
      setPayments(p);
      setInvoices(i);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePay(booking: Booking) {
    if (!accessToken) return;
    setPaying(true);
    setError('');
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new ApiError('Payment gateway could not be loaded.', 503);
      // Server determines the amount; the client only sends an idempotency key.
      const order: PaymentOrder = await paymentsApi.createPayment(accessToken, booking.id, {
        idempotencyKey: `web-${booking.id}-${Date.now()}`,
      });
      if (!order.keyId) {
        throw new ApiError('Payments are not configured. Please try again later.', 503);
      }
      const result = await new Promise<Payment>((resolve, reject) => {
        const RazorpayCtor = window.Razorpay;
        if (!RazorpayCtor) throw new ApiError('Payment gateway could not be loaded.', 503);
        const rzp = new RazorpayCtor({
          key: order.keyId as string,
          amount: order.amount,
          currency: order.currency,
          name: 'Cooperative Gig Platform',
          description: `Payment for ${booking.serviceRequest.title}`,
          order_id: order.providerOrderId,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              resolve(
                await paymentsApi.verifyPayment(accessToken, order.paymentId, {
                  providerOrderId: response.razorpay_order_id,
                  providerPaymentId: response.razorpay_payment_id,
                  providerSignature: response.razorpay_signature,
                }),
              );
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new ApiError('Payment was cancelled.', 409)) },
        });
        rzp.on('payment.failed', () => reject(new ApiError('Payment failed at the gateway.', 402)));
        rzp.open();
      });
      setPayments((prev) => [result, ...prev.filter((x) => x.id !== result.id)]);
      setNotice(
        result.status === 'SUCCESS'
          ? 'Payment successful. Your invoice has been issued.'
          : `Payment is ${result.status.toLowerCase()}.`,
      );
      setPayBooking(null);
      void load();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setPaying(false);
    }
  }

  const unpaid = bookings.filter((b) => b.status === 'COMPLETED');
  const paidBookingIds = new Set(
    payments.filter((p) => p.status === 'SUCCESS').map((p) => p.bookingId),
  );
  const payable = unpaid.filter((b) => !paidBookingIds.has(b.id));

  if (loading) {
    return (
      <div className="stat-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (error && !payments.length && !invoices.length) {
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

      <div className="stat-grid">
        <StatCard label="Payments" value={String(payments.length)} />
        <StatCard
          label="Successful"
          value={String(payments.filter((p) => p.status === 'SUCCESS').length)}
        />
        <StatCard label="Invoices" value={String(invoices.length)} />
      </div>

      <h2 className="section-title">Due for payment</h2>
      {payable.length === 0 ? (
        <EmptyState title="Nothing due" description="Completed services appear here for payment." />
      ) : (
        <div className="member-grid">
          {payable.map((booking) => (
            <GlassCard key={booking.id} className="member-card">
              <h3>{booking.serviceRequest.title}</h3>
              <p className="member-card__meta">
                Worker: <strong>{booking.worker.fullName ?? 'Worker'}</strong>
              </p>
              <p className="member-card__meta">
                Amount due:{' '}
                <strong>
                  {booking.priceAmount != null
                    ? money(booking.priceAmount)
                    : 'Calculated at checkout'}
                </strong>
              </p>
              <div className="member-card__actions" style={{ marginTop: '0.75rem' }}>
                <Button size="sm" disabled={paying} onClick={() => setPayBooking(booking)}>
                  Pay now
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <h2 className="section-title">Payment history</h2>
      {payments.length === 0 ? (
        <EmptyState title="No payments yet" description="Your payment history will appear here." />
      ) : (
        <div className="member-grid">
          {payments.map((p) => (
            <GlassCard key={p.id} className="member-card">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <h3>{money(p.amount, p.currency)}</h3>
                <Badge tone={tone[p.status]}>{p.status}</Badge>
              </div>
              <p className="member-card__meta">{new Date(p.createdAt).toLocaleString()}</p>
              {p.failureReason ? (
                <p className="member-card__meta">Reason: {p.failureReason}</p>
              ) : null}
              {p.invoice ? (
                <p className="member-card__meta">
                  Invoice: <strong>{p.invoice.invoiceNumber}</strong>
                </p>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}

      <h2 className="section-title">Invoices</h2>
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices are issued when a payment succeeds."
        />
      ) : (
        <div className="member-grid">
          {invoices.map((inv) => (
            <GlassCard key={inv.id} className="member-card">
              <h3>{inv.invoiceNumber}</h3>
              <p className="member-card__meta">
                {inv.booking?.serviceRequest.title ?? 'Service'} ·{' '}
                {money(inv.totalAmount, inv.currency)}
              </p>
              <p className="member-card__meta">
                Issued {new Date(inv.issuedAt).toLocaleDateString()}
              </p>
              <div className="member-card__actions" style={{ marginTop: '0.75rem' }}>
                <SecondaryButton size="sm" onClick={() => setDetailInvoice(inv)}>
                  View details
                </SecondaryButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {payBooking ? (
        <Modal
          open
          title="Confirm payment"
          onClose={() => (paying ? undefined : setPayBooking(null))}
        >
          <p>
            Pay for <strong>{payBooking.serviceRequest.title}</strong>? The exact amount is
            confirmed securely on the payment gateway.
          </p>
          <div className="studio-form__actions" style={{ marginTop: '1.25rem' }}>
            <SecondaryButton onClick={() => setPayBooking(null)} disabled={paying}>
              Cancel
            </SecondaryButton>
            <Button disabled={paying} onClick={() => void handlePay(payBooking)}>
              {paying ? 'Opening gateway…' : 'Continue to pay'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {detailInvoice ? (
        <Modal
          open
          title={`Invoice ${detailInvoice.invoiceNumber}`}
          onClose={() => setDetailInvoice(null)}
        >
          <p>
            <strong>{detailInvoice.booking?.serviceRequest.title ?? 'Service'}</strong>
          </p>
          <p>Subtotal: {money(detailInvoice.subtotal, detailInvoice.currency)}</p>
          <p>Tax: {money(detailInvoice.taxAmount, detailInvoice.currency)}</p>
          <p>
            <strong>Total: {money(detailInvoice.totalAmount, detailInvoice.currency)}</strong>
          </p>
          <p>Status: {detailInvoice.status}</p>
          {detailInvoice.paidAt ? (
            <p>Paid: {new Date(detailInvoice.paidAt).toLocaleString()}</p>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
