export type SkillProficiency = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type WorkerAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
export type SkillVerificationStatus =
  'NOT_VERIFIED' | 'ASSESSMENT_PENDING' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VerificationMethod =
  'PRACTICAL_ASSESSMENT' | 'EXPERIENCE_EVIDENCE' | 'CERTIFICATE_EVIDENCE' | 'ADMIN_REVIEW';
export type SkillEvidenceType =
  | 'PRACTICAL_EXPERIENCE'
  | 'WORK_SAMPLE'
  | 'ASSESSMENT'
  | 'TRAINING'
  | 'CERTIFICATE'
  | 'EMPLOYER_OR_CLIENT'
  | 'OTHER';
export type CertificateStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

export interface WorkerProfile {
  id: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  location: string | null;
  yearsExperience: number | null;
  availability: WorkerAvailability | null;
  languages: string[];
  education: {
    qualification: string | null;
    institution: string | null;
    year: number | null;
  } | null;
  skillCount: number;
  experienceCount: number;
  profileCompletion: number;
}

export interface SkillCatalogItem {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkerSkill {
  id: string;
  skill: Pick<SkillCatalogItem, 'id' | 'name'>;
  proficiency: SkillProficiency;
  experienceYears: number;
  experienceSummary: string | null;
  evidenceReference: string | null;
  verificationStatus: SkillVerificationStatus;
  verificationRequestedAt: string | null;
  verifiedAt: string | null;
  certificateCount: number;
  evidenceCount: number;
  latestVerification: VerificationRequest | null;
}

export interface WorkerExperience {
  id: string;
  title: string;
  organization: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  relevantSkills: string[];
}

export interface SkillEvidence {
  id: string;
  type: SkillEvidenceType;
  description: string;
  referenceUrl: string | null;
  createdAt: string;
  skill: Pick<SkillCatalogItem, 'id' | 'name'>;
  experience: Pick<WorkerExperience, 'id' | 'title' | 'organization'> | null;
}

export interface Certificate {
  id: string;
  skill: Pick<SkillCatalogItem, 'id' | 'name'>;
  title: string;
  issuer: string | null;
  referenceNo: string | null;
  documentUrl: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: CertificateStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface VerificationRequest {
  id: string;
  status: SkillVerificationStatus;
  method: VerificationMethod | null;
  note: string | null;
  evidenceReference: string | null;
  assessmentReference: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  worker: { id: string; fullName: string | null };
  skill: {
    id: string;
    name: string;
    proficiency: SkillProficiency;
    experienceYears: number;
    experienceSummary: string | null;
    evidenceReference: string | null;
  };
  certificates: Pick<Certificate, 'id' | 'title' | 'issuer' | 'referenceNo' | 'status'>[];
  evidence: Pick<SkillEvidence, 'id' | 'type' | 'description' | 'referenceUrl' | 'createdAt'>[];
  reviewedByUserId: string | null;
}

export interface CooperativeSummary {
  id: string;
  name: string;
  registrationNo: string | null;
}

export interface UpdateWorkerProfilePayload {
  fullName?: string | null;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  educationQualification?: string | null;
  educationInstitution?: string | null;
  educationYear?: number | null;
  yearsExperience?: number | null;
  availability?: WorkerAvailability | null;
  languages?: string[];
}

export interface WorkerExperiencePayload {
  title: string;
  organization?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  relevantSkills?: string[];
}

export interface WorkerSkillPayload {
  skillId: string;
  proficiency: SkillProficiency;
  experienceYears: number;
  experienceSummary?: string | null;
  evidenceReference?: string | null;
}

export interface SkillEvidencePayload {
  type: SkillEvidenceType;
  description: string;
  referenceUrl?: string | null;
  experienceId?: string | null;
}

export interface CertificatePayload {
  title: string;
  issuer?: string | null;
  referenceNo?: string | null;
  documentUrl?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}
