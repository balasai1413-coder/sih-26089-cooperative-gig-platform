import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';

const cooperativeInclude = {
  admin: { select: { id: true, email: true } },
  _count: { select: { memberships: { where: { leftAt: null } } } },
} satisfies Prisma.CooperativeInclude;

const memberInclude = {
  worker: {
    select: {
      id: true,
      fullName: true,
      location: true,
      yearsExperience: true,
      availability: true,
      userId: true,
      skills: {
        select: {
          id: true,
          proficiency: true,
          experienceYears: true,
          experienceSummary: true,
          verificationStatus: true,
          skill: { select: { id: true, name: true, category: { select: { name: true } } } },
        },
      },
      memberships: {
        select: { cooperativeId: true, role: true, joinedAt: true, leftAt: true },
      },
      user: { select: { id: true, email: true, isActive: true } },
    },
  },
} satisfies Prisma.CooperativeMembershipInclude;

/**
 * Cooperative admin surface. Every query resolves the cooperative through the
 * persisted `adminUserId` relationship; a cooperativeId supplied by a client is
 * never trusted. Membership state follows the existing `leftAt` semantics:
 * an open membership (leftAt null) is active, a closed one is historical.
 */
@Injectable()
export class CooperativesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All cooperatives administered by this user, with counts and stats. */
  async listMine(actor: AuthenticatedUser) {
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { adminUserId: actor.id },
      include: {
        ...cooperativeInclude,
        memberships: {
          where: { leftAt: null },
          select: {
            worker: {
              select: {
                skills: { select: { verificationStatus: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return cooperatives.map((cooperative) => this.toSummary(cooperative));
  }

  async getMine(actor: AuthenticatedUser, cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      include: cooperativeInclude,
    });
    if (!cooperative) throw new NotFoundException('Cooperative is not available');
    return this.toDetail(cooperative);
  }

  async updateMine(actor: AuthenticatedUser, cooperativeId: string, dto: UpdateCooperativeDto) {
    const existing = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Cooperative is not available');
    const cooperative = await this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.operatingArea !== undefined ? { operatingArea: dto.operatingArea } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: cooperativeInclude,
    });
    return this.toDetail(cooperative);
  }

  async listMembers(
    actor: AuthenticatedUser,
    cooperativeId: string,
    query: { search?: string; status?: 'active' | 'former' },
  ) {
    await this.assertAdminOf(actor, cooperativeId);
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: {
        cooperativeId,
        ...(query.status === 'former' ? { leftAt: { not: null } } : { leftAt: null }),
      },
      include: memberInclude,
      orderBy: { joinedAt: 'desc' },
    });
    const search = query.search?.trim().toLowerCase();
    const rows = memberships
      .map((membership) => this.toMember(membership))
      .filter((member) => {
        if (!search) return true;
        const haystack = [member.fullName, member.location, member.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    return rows;
  }

  async getMember(actor: AuthenticatedUser, cooperativeId: string, workerId: string) {
    await this.assertAdminOf(actor, cooperativeId);
    const membership = await this.prisma.cooperativeMembership.findFirst({
      where: { cooperativeId, workerId },
      include: memberInclude,
      orderBy: { joinedAt: 'desc' },
    });
    // A missing membership means the worker is not part of this cooperative.
    // Return 403 rather than 404 so cross-cooperative probing is not rewarded
    // with existence information.
    if (!membership)
      throw new ForbiddenException('You do not have permission to access this resource');
    return this.toMember(membership, { detailed: true });
  }

  private async assertAdminOf(actor: AuthenticatedUser, cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findFirst({
      where: { id: cooperativeId, adminUserId: actor.id },
      select: { id: true },
    });
    if (!cooperative) throw new NotFoundException('Cooperative is not available');
  }

  private toSummary(
    cooperative: Prisma.CooperativeGetPayload<{
      include: typeof cooperativeInclude & {
        memberships: {
          select: { worker: { select: { skills: { select: { verificationStatus: true } } } } };
        };
      };
    }>,
  ) {
    const skillStatuses = cooperative.memberships.flatMap((membership) =>
      membership.worker.skills.map((skill) => skill.verificationStatus),
    );
    return {
      id: cooperative.id,
      name: cooperative.name,
      registrationNo: cooperative.registrationNo,
      status: cooperative.status,
      createdAt: cooperative.createdAt,
      memberCount: cooperative._count.memberships,
      verifiedSkillCount: skillStatuses.filter((status) => status === 'VERIFIED').length,
      pendingVerificationCount: skillStatuses.filter(
        (status) => status === 'PENDING' || status === 'ASSESSMENT_PENDING',
      ).length,
    };
  }

  private toDetail(
    cooperative: Prisma.CooperativeGetPayload<{ include: typeof cooperativeInclude }>,
  ) {
    return {
      id: cooperative.id,
      name: cooperative.name,
      registrationNo: cooperative.registrationNo,
      description: cooperative.description,
      location: cooperative.location,
      operatingArea: cooperative.operatingArea,
      contactEmail: cooperative.contactEmail,
      contactPhone: cooperative.contactPhone,
      status: cooperative.status,
      createdAt: cooperative.createdAt,
      updatedAt: cooperative.updatedAt,
      memberCount: cooperative._count.memberships,
      admin: cooperative.admin,
    };
  }

  private toMember(
    membership: Prisma.CooperativeMembershipGetPayload<{ include: typeof memberInclude }>,
    options: { detailed?: boolean } = {},
  ) {
    const skills = membership.worker.skills.map((skill) => ({
      id: skill.id,
      name: skill.skill.name,
      category: skill.skill.category?.name ?? null,
      proficiency: skill.proficiency,
      experienceYears: skill.experienceYears,
      experienceSummary: skill.experienceSummary,
      verificationStatus: skill.verificationStatus,
    }));
    const openMembership = membership.worker.memberships.find((item) => !item.leftAt) ?? null;
    const member = {
      membershipId: membership.id,
      workerId: membership.worker.id,
      userId: membership.worker.userId,
      fullName: membership.worker.fullName,
      location: membership.worker.location,
      yearsExperience: membership.worker.yearsExperience,
      availability: membership.worker.availability,
      email: membership.worker.user.email,
      accountActive: membership.worker.user.isActive,
      membershipRole: membership.role,
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
      membershipStatus: membership.leftAt ? ('FORMER' as const) : ('ACTIVE' as const),
      skillCount: skills.length,
      verifiedSkillCount: skills.filter((skill) => skill.verificationStatus === 'VERIFIED').length,
      skills: options.detailed
        ? skills
        : skills.filter((skill) => skill.verificationStatus === 'VERIFIED'),
    };
    return {
      ...member,
      // Detailed views see every skill; list views see the verified headline.
      ...(options.detailed ? {} : {}),
      currentCooperativeIds: openMembership ? [openMembership.cooperativeId] : [],
    };
  }
}
