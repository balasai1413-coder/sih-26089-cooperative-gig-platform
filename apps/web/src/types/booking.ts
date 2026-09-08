export type BookingStatus =
  | 'PENDING_WORKER_ACCEPTANCE'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface Booking {
  id: string;
  status: BookingStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  customerNotes: string | null;
  workerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  serviceRequest: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    status: string;
    preferredDateTime: string | null;
    skill: { id: string; name: string } | null;
  };
  worker: {
    id: string;
    fullName: string | null;
    profilePhotoUrl: string | null;
    location: string | null;
    yearsExperience: number | null;
    cooperative: { id: string; name: string } | null;
  };
  customer: {
    id: string;
  };
}

export interface CreateBookingPayload {
  workerId: string;
  scheduledAt?: string | null;
  customerNotes?: string | null;
}

