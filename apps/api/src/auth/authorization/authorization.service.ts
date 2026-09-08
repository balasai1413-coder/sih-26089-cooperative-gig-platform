import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth.types';
import { CooperativeResource, CooperativeScope, OwnershipResource } from './authorization.types';

/**
 * Server-side policy checks. Route ids are only lookup keys: every decision is
 * made from persisted ownership or membership data and the authenticated user.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnership(
    actor: AuthenticatedUser,
    resource: OwnershipResource,
    resourceId: string,
  ): Promise<void> {
    switch (resource) {
      case 'user':
        this.assertSameUser(actor.id, resourceId);
        return;
      case 'customer':
        await this.assertCustomerOwnership(actor.id, resourceId);
        return;
      case 'worker':
        await this.assertWorkerOwnership(actor.id, resourceId);
        return;
      case 'workerSkill':
        await this.assertWorkerSkillOwnership(actor.id, resourceId);
        return;
      case 'workerExperience':
        await this.assertWorkerExperienceOwnership(actor.id, resourceId);
        return;
      case 'skillEvidence':
        await this.assertSkillEvidenceOwnership(actor.id, resourceId);
        return;
      case 'certificate':
        await this.assertCertificateOwnership(actor.id, resourceId);
        return;
    }
  }

  async assertCooperativeScope(
    actor: AuthenticatedUser,
    cooperativeId: string,
    scope: CooperativeScope,
  ): Promise<void> {
    if (scope === 'admin') {
      await this.assertCooperativeAdminScope(actor.id, cooperativeId);
      return;
    }
    await this.assertWorkerMembership(actor.id, cooperativeId);
  }

  async assertCooperativeResourceScope(
    resource: CooperativeResource,
    resourceId: string,
    cooperativeId: string,
  ): Promise<void> {
    const workerId = await this.workerIdForCooperativeResource(resource, resourceId);
    if (!workerId) this.deny();
    await this.assertWorkerIdInCooperative(workerId, cooperativeId);
  }

  private assertSameUser(actorUserId: string, resourceUserId: string): void {
    if (actorUserId !== resourceUserId) this.deny();
  }

  private async assertCustomerOwnership(actorUserId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });
    if (!customer || customer.userId !== actorUserId) this.deny();
  }

  private async assertWorkerOwnership(actorUserId: string, workerId: string): Promise<void> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { userId: true },
    });
    if (!worker || worker.userId !== actorUserId) this.deny();
  }

  private async assertWorkerSkillOwnership(
    actorUserId: string,
    workerSkillId: string,
  ): Promise<void> {
    const workerSkill = await this.prisma.workerSkill.findUnique({
      where: { id: workerSkillId },
      select: { worker: { select: { userId: true } } },
    });
    if (!workerSkill || workerSkill.worker.userId !== actorUserId) this.deny();
  }

  private async assertCertificateOwnership(
    actorUserId: string,
    certificateId: string,
  ): Promise<void> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      select: { workerSkill: { select: { worker: { select: { userId: true } } } } },
    });
    if (!certificate || certificate.workerSkill.worker.userId !== actorUserId) this.deny();
  }

  private async assertWorkerExperienceOwnership(
    actorUserId: string,
    experienceId: string,
  ): Promise<void> {
    const experience = await this.prisma.workerExperience.findUnique({
      where: { id: experienceId },
      select: { worker: { select: { userId: true } } },
    });
    if (!experience || experience.worker.userId !== actorUserId) this.deny();
  }

  private async assertSkillEvidenceOwnership(
    actorUserId: string,
    evidenceId: string,
  ): Promise<void> {
    const evidence = await this.prisma.skillEvidence.findUnique({
      where: { id: evidenceId },
      select: { workerSkill: { select: { worker: { select: { userId: true } } } } },
    });
    if (!evidence || evidence.workerSkill.worker.userId !== actorUserId) this.deny();
  }

  private async assertCooperativeAdminScope(
    actorUserId: string,
    cooperativeId: string,
  ): Promise<void> {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: { adminUserId: true },
    });
    if (!cooperative || cooperative.adminUserId !== actorUserId) this.deny();
  }

  private async assertWorkerMembership(actorUserId: string, cooperativeId: string): Promise<void> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!worker) this.deny();
    await this.assertWorkerIdInCooperative(worker.id, cooperativeId);
  }

  private async workerIdForCooperativeResource(
    resource: CooperativeResource,
    resourceId: string,
  ): Promise<string | null> {
    if (resource === 'worker') {
      const worker = await this.prisma.worker.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
      return worker?.id ?? null;
    }
    if (resource === 'workerSkill') {
      const workerSkill = await this.prisma.workerSkill.findUnique({
        where: { id: resourceId },
        select: { workerId: true },
      });
      return workerSkill?.workerId ?? null;
    }
    const verification = await this.prisma.skillVerification.findUnique({
      where: { id: resourceId },
      select: { workerSkill: { select: { workerId: true } } },
    });
    return verification?.workerSkill.workerId ?? null;
  }

  private async assertWorkerIdInCooperative(
    workerId: string,
    cooperativeId: string,
  ): Promise<void> {
    const membership = await this.prisma.cooperativeMembership.findFirst({
      where: {
        cooperativeId,
        leftAt: null,
        workerId,
      },
      select: { id: true },
    });
    if (!membership) this.deny();
  }

  private deny(): never {
    // Deliberately do not reveal whether a target resource exists.
    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
