import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OWNERSHIP_KEY } from '../authorization/authorization.constants';
import { AuthorizationService } from '../authorization/authorization.service';
import { OwnershipRequirement } from '../authorization/authorization.types';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<OwnershipRequirement>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) throw new UnauthorizedException('Authentication is required');
    const resourceId = request.params?.[requirement.param];
    if (typeof resourceId !== 'string' || !resourceId) this.deny();

    await this.authorization.assertOwnership(request.user, requirement.resource, resourceId);
    return true;
  }

  private deny(): never {
    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
