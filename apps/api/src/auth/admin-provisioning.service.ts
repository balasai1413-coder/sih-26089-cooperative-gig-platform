import { ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

export interface AdminProvisioningInput {
  mobile: string;
  password: string;
  email?: string;
  cooperativeId?: string;
}

@Injectable()
export class AdminProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(input: AdminProvisioningInput) {
    const cooperative = input.cooperativeId
      ? await this.prisma.cooperative.findUnique({
          where: { id: input.cooperativeId },
          select: { id: true, adminUserId: true },
        })
      : null;
    if (input.cooperativeId && !cooperative) {
      throw new ConflictException('Cooperative is not available');
    }

    const existing = await this.prisma.user.findUnique({
      where: { mobile: input.mobile },
      select: { id: true },
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            role: UserRole.COOPERATIVE_ADMIN,
            ...(input.email ? { email: input.email } : {}),
            passwordHash: await bcrypt.hash(input.password, 12),
            refreshTokenHash: null,
          },
          select: { id: true, mobile: true, email: true, role: true },
        })
      : await this.prisma.user.create({
          data: {
            mobile: input.mobile,
            email: input.email,
            passwordHash: await bcrypt.hash(input.password, 12),
            role: UserRole.COOPERATIVE_ADMIN,
          },
          select: { id: true, mobile: true, email: true, role: true },
        });

    if (cooperative) {
      if (cooperative.adminUserId && cooperative.adminUserId !== user.id) {
        throw new ConflictException('Cooperative already has another administrator');
      }
      await this.prisma.cooperative.update({
        where: { id: cooperative.id },
        data: { adminUserId: user.id },
      });
    }

    return user;
  }
}