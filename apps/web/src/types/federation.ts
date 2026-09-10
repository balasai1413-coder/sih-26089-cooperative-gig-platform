export interface FederationSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  activeCooperativeCount: number;
}

export interface FederationOverview extends FederationSummary {
  activeCooperatives: number;
  activeWorkers: number;
  verifiedWorkers: number;
  openDemand: number;
  welfareParticipation: number;
}

export interface FederationCooperative {
  id: string;
  name: string;
  registrationNo: string | null;
  location: string | null;
  cooperativeStatus: string;
  membershipStatus: string;
  activeWorkers: number;
  verifiedWorkers: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  serviceRequests: number;
  averageRating: number | null;
  welfareEnrolledWorkers: number;
}

export interface FederationWorkforce {
  totalActiveWorkers: number;
  totalVerifiedWorkers: number;
  availableWorkers: number;
  priorityCapacity: number;
  bySkill: { id: string; name: string; category: string | null; verifiedWorkers: number }[];
}

export interface FederationWelfare {
  eligibleWorkers: number;
  enrolledWorkers: number;
  activeBenefits: number;
  pendingEnrollments: number;
  submittedClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  participationRate: number;
}
