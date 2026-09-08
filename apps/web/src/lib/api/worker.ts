import { apiRequest } from './client';
import type {
  Certificate,
  CertificatePayload,
  CooperativeSummary,
  SkillCatalogItem,
  SkillEvidence,
  SkillEvidencePayload,
  UpdateWorkerProfilePayload,
  VerificationMethod,
  VerificationRequest,
  WorkerExperience,
  WorkerExperiencePayload,
  WorkerProfile,
  WorkerSkill,
  WorkerSkillPayload,
} from '@/types/worker';

function withToken(accessToken: string, method?: string, body?: unknown) {
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    accessToken,
  };
}

export const workerApi = {
  profile: (accessToken: string) =>
    apiRequest<WorkerProfile>('/workers/me', withToken(accessToken)),
  updateProfile: (accessToken: string, payload: UpdateWorkerProfilePayload) =>
    apiRequest<WorkerProfile>('/workers/me', withToken(accessToken, 'PATCH', payload)),
  catalog: (accessToken: string) =>
    apiRequest<SkillCatalogItem[]>('/workers/me/skill-catalog', withToken(accessToken)),
  skills: (accessToken: string) =>
    apiRequest<WorkerSkill[]>('/workers/me/skills', withToken(accessToken)),
  addSkill: (accessToken: string, payload: WorkerSkillPayload) =>
    apiRequest<WorkerSkill>('/workers/me/skills', withToken(accessToken, 'POST', payload)),
  updateSkill: (accessToken: string, workerSkillId: string, payload: Partial<WorkerSkillPayload>) =>
    apiRequest<WorkerSkill>(
      `/workers/me/skills/${workerSkillId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  removeSkill: (accessToken: string, workerSkillId: string) =>
    apiRequest<{ success: true }>(
      `/workers/me/skills/${workerSkillId}`,
      withToken(accessToken, 'DELETE'),
    ),
  experiences: (accessToken: string) =>
    apiRequest<WorkerExperience[]>('/workers/me/experiences', withToken(accessToken)),
  addExperience: (accessToken: string, payload: WorkerExperiencePayload) =>
    apiRequest<WorkerExperience>(
      '/workers/me/experiences',
      withToken(accessToken, 'POST', payload),
    ),
  updateExperience: (
    accessToken: string,
    experienceId: string,
    payload: Partial<WorkerExperiencePayload>,
  ) =>
    apiRequest<WorkerExperience>(
      `/workers/me/experiences/${experienceId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  removeExperience: (accessToken: string, experienceId: string) =>
    apiRequest<{ success: true }>(
      `/workers/me/experiences/${experienceId}`,
      withToken(accessToken, 'DELETE'),
    ),
  evidence: (accessToken: string) =>
    apiRequest<SkillEvidence[]>('/workers/me/evidence', withToken(accessToken)),
  addEvidence: (accessToken: string, workerSkillId: string, payload: SkillEvidencePayload) =>
    apiRequest<SkillEvidence>(
      `/workers/me/skills/${workerSkillId}/evidence`,
      withToken(accessToken, 'POST', payload),
    ),
  updateEvidence: (
    accessToken: string,
    evidenceId: string,
    payload: Partial<SkillEvidencePayload>,
  ) =>
    apiRequest<SkillEvidence>(
      `/workers/me/evidence/${evidenceId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  removeEvidence: (accessToken: string, evidenceId: string) =>
    apiRequest<{ success: true }>(
      `/workers/me/evidence/${evidenceId}`,
      withToken(accessToken, 'DELETE'),
    ),
  certificates: (accessToken: string) =>
    apiRequest<Certificate[]>('/workers/me/certificates', withToken(accessToken)),
  addCertificate: (accessToken: string, workerSkillId: string, payload: CertificatePayload) =>
    apiRequest<Certificate>(
      `/workers/me/skills/${workerSkillId}/certificates`,
      withToken(accessToken, 'POST', payload),
    ),
  updateCertificate: (
    accessToken: string,
    certificateId: string,
    payload: Partial<CertificatePayload>,
  ) =>
    apiRequest<Certificate>(
      `/workers/me/certificates/${certificateId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  removeCertificate: (accessToken: string, certificateId: string) =>
    apiRequest<{ success: true }>(
      `/workers/me/certificates/${certificateId}`,
      withToken(accessToken, 'DELETE'),
    ),
  verificationRequests: (accessToken: string) =>
    apiRequest<VerificationRequest[]>('/workers/me/verification-requests', withToken(accessToken)),
  requestVerification: (
    accessToken: string,
    workerSkillId: string,
    payload: {
      method: VerificationMethod;
      evidenceReference?: string | null;
      assessmentReference?: string | null;
      note?: string | null;
    },
  ) =>
    apiRequest<VerificationRequest>(
      `/workers/me/skills/${workerSkillId}/verification-requests`,
      withToken(accessToken, 'POST', payload),
    ),
  cooperatives: (accessToken: string) =>
    apiRequest<CooperativeSummary[]>('/cooperatives/me', withToken(accessToken)),
  cooperativeRequests: (accessToken: string, cooperativeId: string) =>
    apiRequest<VerificationRequest[]>(
      `/cooperatives/${cooperativeId}/verification-requests`,
      withToken(accessToken),
    ),
  reviewVerification: (
    accessToken: string,
    cooperativeId: string,
    verificationId: string,
    payload: { decision: 'VERIFIED' | 'REJECTED'; note?: string },
  ) =>
    apiRequest<VerificationRequest>(
      `/cooperatives/${cooperativeId}/verification-requests/${verificationId}`,
      withToken(accessToken, 'PATCH', payload),
    ),
  /** Step 8 — list worker assigned bookings. */
  bookings: (accessToken: string) =>
    apiRequest<import('@/types/booking').Booking[]>('/workers/me/bookings', withToken(accessToken)),
  /** Step 8 — get single worker assignment. */
  booking: (accessToken: string, bookingId: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/workers/me/bookings/${bookingId}`,
      withToken(accessToken),
    ),
  /** Step 8 — accept assigned booking. */
  acceptBooking: (accessToken: string, bookingId: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/workers/me/bookings/${bookingId}/accept`,
      withToken(accessToken, 'POST'),
    ),
  /** Step 8 — reject assigned booking. */
  rejectBooking: (accessToken: string, bookingId: string, workerNotes?: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/workers/me/bookings/${bookingId}/reject`,
      withToken(accessToken, 'POST', workerNotes ? { workerNotes } : {}),
    ),
  /** Step 8 — start service on accepted booking. */
  startBooking: (accessToken: string, bookingId: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/workers/me/bookings/${bookingId}/start`,
      withToken(accessToken, 'POST'),
    ),
  /** Step 8 — complete service on in-progress booking. */
  completeBooking: (accessToken: string, bookingId: string, workerNotes?: string) =>
    apiRequest<import('@/types/booking').Booking>(
      `/workers/me/bookings/${bookingId}/complete`,
      withToken(accessToken, 'POST', workerNotes ? { workerNotes } : {}),
    ),
};
