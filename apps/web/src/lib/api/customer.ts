import { apiRequest } from './client';
import type {
  CreateServiceRequestPayload,
  PublicWorkerProfile,
  ServiceRequest,
  UpdateServiceRequestPayload,
  WorkerMatch,
} from '@/types/customer';

function withToken(accessToken: string, method?: string, body?: unknown) {
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    accessToken,
  };
}

export interface CatalogSkill {
  id: string;
  name: string;
}

export const customerApi = {
  skillsCatalog: (accessToken: string) =>
    apiRequest<CatalogSkill[]>('/skills', withToken(accessToken)),
  serviceRequests: (accessToken: string) =>
    apiRequest<ServiceRequest[]>('/customers/me/service-requests', withToken(accessToken)),
  serviceRequest: (accessToken: string, requestId: string) =>
    apiRequest<ServiceRequest>(
      `/customers/me/service-requests/${requestId}`,
      withToken(accessToken),
    ),
  createServiceRequest: (accessToken: string, payload: CreateServiceRequestPayload) =>
    apiRequest<ServiceRequest>(
      '/customers/me/service-requests',
      withToken(accessToken, 'POST', payload),
    ),
  updateServiceRequest: (
    accessToken: string,
    requestId: string,
    payload: UpdateServiceRequestPayload,
  ) =>
    apiRequest<ServiceRequest>(
      `/customers/me/service-requests/${requestId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  cancelServiceRequest: (accessToken: string, requestId: string) =>
    apiRequest<ServiceRequest>(
      `/customers/me/service-requests/${requestId}`,
      withToken(accessToken, 'DELETE'),
    ),
  /** Step 7 — discover eligible workers for one of the customer's own OPEN requests. */
  findMatches: (accessToken: string, requestId: string) =>
    apiRequest<WorkerMatch[]>(
      `/customers/me/service-requests/${requestId}/matches`,
      withToken(accessToken),
    ),
  /** Step 7 — safe public worker profile. */
  publicWorkerProfile: (accessToken: string, workerId: string) =>
    apiRequest<PublicWorkerProfile>(`/workers/${workerId}/public`, withToken(accessToken)),
  /** Step 8 — create booking from matched worker. */
  createBooking: (
    accessToken: string,
    requestId: string,
    payload: import('@/types/booking').CreateBookingPayload,
  ) =>
    apiRequest<import('@/types/booking').Booking>(
      `/customers/me/service-requests/${requestId}/bookings`,
      withToken(accessToken, 'POST', payload),
    ),
  /** Step 8 — customer bookings list. */
  bookings: (accessToken: string) =>
    apiRequest<import('@/types/booking').Booking[]>(
      '/customers/me/bookings',
      withToken(accessToken),
    ),
  /** Step 8 — customer booking detail. */
  booking: (accessToken: string, bookingId: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/customers/me/bookings/${bookingId}`,
      withToken(accessToken),
    ),
  /** Step 8 — cancel customer booking. */
  cancelBooking: (accessToken: string, bookingId: string, customerNotes?: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/customers/me/bookings/${bookingId}/cancel`,
      withToken(accessToken, 'POST', customerNotes ? { customerNotes } : {}),
    ),
};

/** Step 7 — public worker profile shape returned by the backend. */
export type { PublicWorkerProfile } from '@/types/customer';
export type { Booking, BookingStatus, CreateBookingPayload } from '@/types/booking';
