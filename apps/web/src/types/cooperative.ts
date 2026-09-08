export type CooperativeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface CooperativeSummary {
  id: string;
  name: string;
  registrationNo: string | null;
  status: CooperativeStatus;
  createdAt: string;
  memberCount: number;
  verifiedSkillCount: number;
  pendingVerificationCount: number;
}

export interface CooperativeProfile {
  id: string;
  name: string;
  registrationNo: string | null;
  description: string | null;
  location: string | null;
  operatingArea: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: CooperativeStatus;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  admin: { id: string | null; email: string | null };
}

export interface CooperativeMember {
  membershipId: string;
  workerId: string;
  userId: string;
  fullName: string | null;
  location: string | null;
  yearsExperience: number | null;
  availability: string | null;
  email: string | null;
  accountActive: boolean;
  membershipRole: string;
  joinedAt: string;
  leftAt: string | null;
  membershipStatus: 'ACTIVE' | 'FORMER';
  skillCount: number;
  verifiedSkillCount: number;
  skills: {
    id: string;
    name: string;
    category: string | null;
    proficiency: string;
    experienceYears: number;
    experienceSummary: string | null;
    verificationStatus: string;
  }[];
}

export interface MemberDetail extends CooperativeMember {
  currentCooperativeIds: string[];
}

export interface SkillCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  skillCount: number;
}

export interface SkillCatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: { id: string; name: string } | null;
}

export interface AdminSkill {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  category: { id: string; name: string } | null;
  workerCount: number;
}

export interface CreateSkillPayload {
  name: string;
  description?: string | null;
  categoryId?: string | null;
}

export interface UpdateSkillPayload {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
}

export interface UpdateCooperativePayload {
  name?: string;
  description?: string | null;
  location?: string | null;
  operatingArea?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: CooperativeStatus;
}
