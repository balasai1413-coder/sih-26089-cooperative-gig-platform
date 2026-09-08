import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedUser } from './auth.types';
import { AuthService, AuthResponse } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticationGuard } from './guards/authentication.guard';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/customer')
  async registerCustomer(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.setRefreshCookie(response, await this.authService.registerCustomer(dto));
  }

  @Post('register/worker')
  async registerWorker(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.setRefreshCookie(response, await this.authService.registerWorker(dto));
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.setRefreshCookie(response, await this.authService.login(dto));
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const refreshToken = this.getRefreshCookie(request);
    return this.setRefreshCookie(response, await this.authService.refresh(refreshToken));
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    response.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
    return this.authService.logout(user.id);
  }

  @Get('me')
  @UseGuards(AuthenticationGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  private setRefreshCookie(
    response: Response,
    session: AuthResponse & { refreshToken: string },
  ): AuthResponse {
    response.cookie(REFRESH_COOKIE, session.refreshToken, this.refreshCookieOptions());
    return { user: session.user, accessToken: session.accessToken };
  }

  private getRefreshCookie(request: Request): string {
    const value = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim().split('='))
      .find(([name]) => name === REFRESH_COOKIE)?.[1];

    if (!value) {
      throw new UnauthorizedException('Refresh token cookie is required');
    }
    try {
      return decodeURIComponent(value);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth',
      maxAge: this.refreshCookieMaxAge(),
    };
  }

  private refreshCookieMaxAge(): number {
    const ttl = process.env.JWT_REFRESH_TTL ?? '7d';
    const match = /^([1-9]\d*)([smhd]?)$/.exec(ttl);
    if (!match) {
      throw new Error('JWT_REFRESH_TTL must be a positive duration such as 15m or 7d');
    }
    const amount = Number(match[1]);
    const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * (units[match[2] || 's'] ?? 1_000);
  }
}
