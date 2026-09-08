import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { COOPERATIVE_SCOPE_KEY } from '../authorization/authorization.constants';
import { AuthorizationService } from '../authorization/authorization.service';
import { CooperativeScopeRequirement } from '../authorization/authorization.types';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class CooperativeScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<CooperativeScopeRequirement>(
      COOPERATIVE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) throw new UnauthorizedException('Authentication is required');
    const cooperativeId = request.params?.[requirement.param];
    if (typeof cooperativeId !== 'string' || !cooperativeId) this.deny();

    await this.authorization.assertCooperativeScope(request.user, cooperativeId, requirement.scope);
    return true;
  }

  private deny(): never {
    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
