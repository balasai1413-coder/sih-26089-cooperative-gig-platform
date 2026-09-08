import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type SafeUser = Pick<User, 'id' | 'mobile' | 'email' | 'role' | 'createdAt'>;

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

interface SessionTokens extends AuthResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit(): void {
    this.getSecret('JWT_ACCESS_SECRET');
    this.getSecret('JWT_REFRESH_SECRET');
    this.getTtl('JWT_ACCESS_TTL', '15m');
    this.getTtl('JWT_REFRESH_TTL', '7d');
  }

  registerCustomer(dto: RegisterDto): Promise<SessionTokens> {
    return this.register(dto, UserRole.CUSTOMER);
  }

  registerWorker(dto: RegisterDto): Promise<SessionTokens> {
    return this.register(dto, UserRole.WORKER);
  }

  async login(dto: LoginDto): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({ where: { mobile: dto.mobile } });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid mobile number or password');
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getSecret('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueSession(user);
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { success: true };
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not available');
    }
    return this.toSafeUser(user);
  }

  private async register(dto: RegisterDto, role: UserRole): Promise<SessionTokens> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ mobile: dto.mobile }, ...(dto.email ? [{ email: dto.email }] : [])],
      },
    });
    if (existing) {
      throw new ConflictException('An account with this mobile number or email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const user = await this.prisma.user.create({
        data: {
          mobile: dto.mobile,
          email: dto.email,
          passwordHash,
          role,
          ...(role === UserRole.CUSTOMER
            ? { customer: { create: {} } }
            : { worker: { create: {} } }),
        },
      });
      return this.issueSession(user);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('An account with this mobile number or email already exists');
      }
      throw error;
    }
  }

  private async issueSession(user: User): Promise<SessionTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role, type: 'access' } satisfies JwtPayload,
      {
        secret: this.getSecret('JWT_ACCESS_SECRET'),
        expiresIn: this.getTtl('JWT_ACCESS_TTL', '15m'),
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role, type: 'refresh' } satisfies JwtPayload,
      {
        secret: this.getSecret('JWT_REFRESH_SECRET'),
        expiresIn: this.getTtl('JWT_REFRESH_TTL', '7d'),
      },
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 12) },
    });
    return { user: this.toSafeUser(user), accessToken, refreshToken };
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private getSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const secret = process.env[name];
    if (!secret || secret.length < 32) {
      throw new Error(`${name} must be set to a value of at least 32 characters`);
    }
    return secret;
  }

  private getTtl(
    name: 'JWT_ACCESS_TTL' | 'JWT_REFRESH_TTL',
    fallback: string,
  ): SignOptions['expiresIn'] {
    const value = process.env[name] ?? fallback;
    if (!/^[1-9]\d*[smhd]?$/.test(value)) {
      throw new Error(`${name} must be a positive duration such as 15m or 7d`);
    }
    return value as SignOptions['expiresIn'];
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
