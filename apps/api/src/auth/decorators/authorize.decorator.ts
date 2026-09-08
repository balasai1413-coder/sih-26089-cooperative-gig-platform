import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  COOPERATIVE_RESOURCE_SCOPE_KEY,
  COOPERATIVE_SCOPE_KEY,
  OWNERSHIP_KEY,
} from '../authorization/authorization.constants';
import {
  AuthorizeOptions,
  CooperativeResourceScopeRequirement,
  CooperativeScopeRequirement,
  OwnershipRequirement,
} from '../authorization/authorization.types';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { CooperativeScopeGuard } from '../guards/cooperative-scope.guard';
import { CooperativeResourceScopeGuard } from '../guards/cooperative-resource-scope.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

export {
  COOPERATIVE_RESOURCE_SCOPE_KEY,
  COOPERATIVE_SCOPE_KEY,
  OWNERSHIP_KEY,
} from '../authorization/authorization.constants';

export function RequireOwnership(requirement: OwnershipRequirement) {
  return SetMetadata(OWNERSHIP_KEY, requirement);
}

export function RequireCooperativeScope(requirement: CooperativeScopeRequirement) {
  return SetMetadata(COOPERATIVE_SCOPE_KEY, requirement);
}

export function RequireCooperativeResourceScope(requirement: CooperativeResourceScopeRequirement) {
  return SetMetadata(COOPERATIVE_RESOURCE_SCOPE_KEY, requirement);
}

/**
 * Default protection for future controllers: authentication, server-signed
 * role checks, then persisted ownership and cooperative scope checks.
 */
export function Authorize(options: AuthorizeOptions) {
  const decorators = [
    Roles(...options.roles),
    ...(options.ownership ? [RequireOwnership(options.ownership)] : []),
    ...(options.cooperativeScope ? [RequireCooperativeScope(options.cooperativeScope)] : []),
    ...(options.cooperativeResourceScope
      ? [RequireCooperativeResourceScope(options.cooperativeResourceScope)]
      : []),
    UseGuards(
      AuthenticationGuard,
      RolesGuard,
      OwnershipGuard,
      CooperativeScopeGuard,
      CooperativeResourceScopeGuard,
    ),
  ];
  return applyDecorators(...decorators);
}
