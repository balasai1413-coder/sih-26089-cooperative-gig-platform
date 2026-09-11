export type ServiceRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
export type ServiceRequestPriority = 'NORMAL' | 'EMERGENCY';

export interface ServiceRequest {
  id: string;
  title: string;
  description: string | null;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  location: string | null;
  preferredDateTime: string | null;
  createdAt: string;
  updatedAt: string;
  skill: { id: string; name: string } | null;
}

export interface CreateServiceRequestPayload {
  skillId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  preferredDateTime?: string | null;
  priority?: ServiceRequestPriority;
}

export interface UpdateServiceRequestPayload {
  title?: string;
  description?: string | null;
  location?: string | null;
  preferredDateTime?: string | null;
  priority?: ServiceRequestPriority;
}

/** Step 7 — deterministic, explainable worker match returned by the backend. */
export interface WorkerMatch {
  workerId: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  location: string | null;
  experienceYears: number;
  proficiency: string;
  availability: string | null;
  cooperative: { id: string; name: string } | null;
  skill: { name: string };
  distanceKm: number | null;
  score: number;
  matchReasons: string[];
}

/** Step 7 — safe public worker profile returned by the backend. */
export interface PublicWorkerProfile {
  fullName: string | null;
  profilePhotoUrl: string | null;
  location: string | null;
  availability: string | null;
  languages: string[];
  yearsExperience: number | null;
  bio: string | null;
  profileCompletion: number;
  verifiedSkills: {
    name: string;
    category: string | null;
    proficiency: string;
    experienceYears: number;
    experienceSummary: string | null;
  }[];
  cooperatives: { id: string; name: string }[];
  reputation: {
    averageRating: number | null;
    totalReviews: number;
    ratingDistribution: {
      '1': number;
      '2': number;
      '3': number;
      '4': number;
      '5': number;
    };
  };
}
