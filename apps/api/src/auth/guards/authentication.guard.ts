import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getSecret('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid access token');
      }

      (request as Request & { user: AuthenticatedUser }).user = {
        id: payload.sub,
        mobile: '',
        email: null,
        role: payload.role,
      } as AuthenticatedUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }

  private getSecret(name: 'JWT_ACCESS_SECRET'): string {
    const secret = process.env[name];
    if (!secret || secret.length < 32) {
      throw new Error(`${name} must be set to a value of at least 32 characters`);
    }
    return secret;
  }
}
