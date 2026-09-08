import { UserRole } from '@prisma/client';

/** Server-resolved ownership targets supported by the Step 3 policy layer. */
export type OwnershipResource =
  | 'user'
  | 'customer'
  | 'worker'
  | 'workerSkill'
  | 'workerExperience'
  | 'skillEvidence'
  | 'certificate';

export interface OwnershipRequirement {
  resource: OwnershipResource;
  /** Name of the route parameter that identifies the persisted resource. */
  param: string;
}

export type CooperativeScope = 'admin' | 'worker';

export interface CooperativeScopeRequirement {
  scope: CooperativeScope;
  /** Name of the route parameter that identifies the cooperative. */
  param: string;
}

/** Resources whose cooperative scope is derived through a worker membership. */
export type CooperativeResource = 'worker' | 'workerSkill' | 'skillVerification';

export interface CooperativeResourceScopeRequirement {
  resource: CooperativeResource;
  resourceParam: string;
  cooperativeParam: string;
}

export interface AuthorizeOptions {
  roles: UserRole[];
  ownership?: OwnershipRequirement;
  cooperativeScope?: CooperativeScopeRequirement;
  cooperativeResourceScope?: CooperativeResourceScopeRequirement;
}
