import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { COOPERATIVE_RESOURCE_SCOPE_KEY } from '../authorization/authorization.constants';
import { AuthorizationService } from '../authorization/authorization.service';
import { CooperativeResourceScopeRequirement } from '../authorization/authorization.types';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class CooperativeResourceScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<CooperativeResourceScopeRequirement>(
      COOPERATIVE_RESOURCE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) throw new UnauthorizedException('Authentication is required');
    const resourceId = request.params?.[requirement.resourceParam];
    const cooperativeId = request.params?.[requirement.cooperativeParam];
    if (typeof resourceId !== 'string' || typeof cooperativeId !== 'string') this.deny();

    await this.authorization.assertCooperativeResourceScope(
      requirement.resource,
      resourceId,
      cooperativeId,
    );
    return true;
  }

  private deny(): never {
    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
