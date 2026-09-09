import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, SkillVerificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AddCertificateDto, UpdateCertificateDto } from './dto/certificate.dto';
import { CreateWorkerExperienceDto, UpdateWorkerExperienceDto } from './dto/worker-experience.dto';
import { AddSkillEvidenceDto, UpdateSkillEvidenceDto } from './dto/skill-evidence.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { AddWorkerSkillDto, UpdateWorkerSkillDto } from './dto/worker-skill.dto';

const profileInclude = {
  skills: { select: { id: true } },
  experiences: { select: { id: true } },
} satisfies Prisma.WorkerInclude;

const workerSkillInclude = {
  skill: { select: { id: true, name: true } },
  verifications: {
    orderBy: { requestedAt: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      method: true,
      notes: true,
      evidenceReference: true,
      assessmentReference: true,
      requestedAt: true,
      reviewedAt: true,
    },
  },
  _count: { select: { certificates: true, evidence: true } },
} satisfies Prisma.WorkerSkillInclude;

const certificateInclude = {
  workerSkill: { include: { skill: { select: { id: true, name: true } } } },
} satisfies Prisma.CertificateInclude;

const evidenceInclude = {
  workerSkill: { include: { skill: { select: { id: true, name: true } } } },
  experience: { select: { id: true, title: true, organization: true } },
} satisfies Prisma.SkillEvidenceInclude;

type WorkerSkillWithDetails = Prisma.WorkerSkillGetPayload<{
  include: typeof workerSkillInclude;
}>;
type CertificateWithDetails = Prisma.CertificateGetPayload<{ include: typeof certificateInclude }>;
type EvidenceWithDetails = Prisma.SkillEvidenceGetPayload<{ include: typeof evidenceInclude }>;

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly reviewsService?: ReviewsService,
  ) {}

  async getMyProfile(actor: AuthenticatedUser) {
    return this.toProfile(await this.findWorkerProfile(actor.id));
  }

  async updateMyProfile(actor: AuthenticatedUser, dto: UpdateWorkerProfileDto) {
    await this.prisma.worker.update({
      where: { userId: actor.id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.profilePhotoUrl !== undefined ? { profilePhotoUrl: dto.profilePhotoUrl } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.educationQualification !== undefined
          ? { educationQualification: dto.educationQualification }
          : {}),
        ...(dto.educationInstitution !== undefined
          ? { educationInstitution: dto.educationInstitution }
          : {}),
        ...(dto.educationYear !== undefined ? { educationYear: dto.educationYear } : {}),
        ...(dto.yearsExperience !== undefined ? { yearsExperience: dto.yearsExperience } : {}),
        ...(dto.availability !== undefined ? { availability: dto.availability } : {}),
        ...(dto.languages !== undefined ? { languages: dto.languages } : {}),
      },
      include: profileInclude,
    });
    return this.toProfile(await this.findWorkerProfile(actor.id));
  }

  async listMySkills(actor: AuthenticatedUser) {
    const worker = await this.findWorker(actor.id);
    const skills = await this.prisma.workerSkill.findMany({
      where: { workerId: worker.id },
      include: workerSkillInclude,
      orderBy: { createdAt: 'desc' },
    });
    return skills.map((workerSkill) => this.toSkill(workerSkill));
  }

  /** Worker-facing catalog: only active skills are offered for selection. */
  async listSkillCatalog() {
    return this.prisma.skill.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async addMySkill(actor: AuthenticatedUser, dto: AddWorkerSkillDto) {
    const worker = await this.findWorker(actor.id);
    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
      select: { id: true, active: true },
    });
    if (!skill || !skill.active) {
      throw new NotFoundException('Skill is not available in the catalog');
    }
    try {
      const workerSkill = await this.prisma.workerSkill.create({
        data: {
          workerId: worker.id,
          skillId: dto.skillId,
          proficiency: dto.proficiency,
          experienceYears: dto.experienceYears,
          experienceSummary: dto.experienceSummary,
          evidenceReference: dto.evidenceReference,
          // Initial status is set by the server; a certificate or client body
          // can never make this record verified.
          verificationStatus: SkillVerificationStatus.NOT_VERIFIED,
        },
        include: workerSkillInclude,
      });
      return this.toSkill(workerSkill);
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('This skill is already in your profile');
      }
      throw error;
    }
  }

  async updateMySkill(workerSkillId: string, dto: UpdateWorkerSkillDto) {
    const workerSkill = await this.prisma.workerSkill.update({
      where: { id: workerSkillId },
      data: {
        ...(dto.proficiency !== undefined ? { proficiency: dto.proficiency } : {}),
        ...(dto.experienceYears !== undefined ? { experienceYears: dto.experienceYears } : {}),
        ...(dto.experienceSummary !== undefined
          ? { experienceSummary: dto.experienceSummary }
          : {}),
        ...(dto.evidenceReference !== undefined
          ? { evidenceReference: dto.evidenceReference }
          : {}),
      },
      include: workerSkillInclude,
    });
    return this.toSkill(workerSkill);
  }

  async removeMySkill(workerSkillId: string): Promise<{ success: true }> {
    await this.prisma.workerSkill.delete({ where: { id: workerSkillId } });
    return { success: true };
  }

  async listMyExperiences(actor: AuthenticatedUser) {
    const worker = await this.findWorker(actor.id);
    const experiences = await this.prisma.workerExperience.findMany({
      where: { workerId: worker.id },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return experiences.map((experience) => this.toExperience(experience));
  }

  async addMyExperience(actor: AuthenticatedUser, dto: CreateWorkerExperienceDto) {
    const worker = await this.findWorker(actor.id);
    this.assertExperienceDates(dto.startDate, dto.endDate, dto.isCurrent ?? false);
    const experience = await this.prisma.workerExperience.create({
      data: {
        workerId: worker.id,
        title: dto.title,
        organization: dto.organization,
        startDate: dto.startDate,
        endDate: dto.isCurrent ? null : dto.endDate,
        isCurrent: dto.isCurrent ?? false,
        description: dto.description,
        relevantSkills: dto.relevantSkills ?? [],
      },
    });
    return this.toExperience(experience);
  }

  async updateMyExperience(
    actor: AuthenticatedUser,
    experienceId: string,
    dto: UpdateWorkerExperienceDto,
  ) {
    const existing = await this.prisma.workerExperience.findFirst({
      where: { id: experienceId, worker: { userId: actor.id } },
    });
    if (!existing) throw new NotFoundException('Experience is not available');
    const isCurrent = dto.isCurrent ?? existing.isCurrent;
    const startDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const endDate = isCurrent ? null : dto.endDate !== undefined ? dto.endDate : existing.endDate;
    this.assertExperienceDates(startDate, endDate, isCurrent);
    const experience = await this.prisma.workerExperience.update({
      where: { id: experienceId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.organization !== undefined ? { organization: dto.organization } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
        ...(dto.endDate !== undefined || isCurrent ? { endDate } : {}),
        ...(dto.isCurrent !== undefined ? { isCurrent } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.relevantSkills !== undefined ? { relevantSkills: dto.relevantSkills } : {}),
      },
    });
    return this.toExperience(experience);
  }

  async removeMyExperience(experienceId: string): Promise<{ success: true }> {
    await this.prisma.workerExperience.delete({ where: { id: experienceId } });
    return { success: true };
  }

  async listMyEvidence(actor: AuthenticatedUser) {
    const worker = await this.findWorker(actor.id);
    const evidence = await this.prisma.skillEvidence.findMany({
      where: { workerSkill: { workerId: worker.id } },
      include: evidenceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return evidence.map((item) => this.toEvidence(item));
  }

  async addMyEvidence(actor: AuthenticatedUser, workerSkillId: string, dto: AddSkillEvidenceDto) {
    const worker = await this.findWorker(actor.id);
    if (dto.experienceId) await this.assertExperienceBelongsToWorker(dto.experienceId, worker.id);
    const evidence = await this.prisma.skillEvidence.create({
      data: {
        workerSkillId,
        experienceId: dto.experienceId,
        type: dto.type,
        description: dto.description,
        referenceUrl: dto.referenceUrl,
      },
      include: evidenceInclude,
    });
    return this.toEvidence(evidence);
  }

  async updateMyEvidence(
    actor: AuthenticatedUser,
    evidenceId: string,
    dto: UpdateSkillEvidenceDto,
  ) {
    const worker = await this.findWorker(actor.id);
    const existing = await this.prisma.skillEvidence.findFirst({
      where: { id: evidenceId, workerSkill: { workerId: worker.id } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Evidence is not available');
    if (dto.experienceId) await this.assertExperienceBelongsToWorker(dto.experienceId, worker.id);
    const evidence = await this.prisma.skillEvidence.update({
      where: { id: evidenceId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.referenceUrl !== undefined ? { referenceUrl: dto.referenceUrl } : {}),
        ...(dto.experienceId !== undefined ? { experienceId: dto.experienceId } : {}),
      },
      include: evidenceInclude,
    });
    return this.toEvidence(evidence);
  }

  async removeMyEvidence(evidenceId: string): Promise<{ success: true }> {
    await this.prisma.skillEvidence.delete({ where: { id: evidenceId } });
    return { success: true };
  }

  async listMyCertificates(actor: AuthenticatedUser) {
    const worker = await this.findWorker(actor.id);
    const certificates = await this.prisma.certificate.findMany({
      where: { workerSkill: { workerId: worker.id } },
      include: certificateInclude,
      orderBy: { submittedAt: 'desc' },
    });
    return certificates.map((certificate) => this.toCertificate(certificate));
  }

  async addMyCertificate(workerSkillId: string, dto: AddCertificateDto) {
    const certificate = await this.prisma.certificate.create({
      data: {
        workerSkillId,
        title: dto.title,
        issuer: dto.issuer,
        referenceNo: dto.referenceNo,
        documentUrl: dto.documentUrl,
        issuedAt: dto.issuedAt,
        expiresAt: dto.expiresAt,
      },
      include: certificateInclude,
    });
    return this.toCertificate(certificate);
  }

  async updateMyCertificate(certificateId: string, dto: UpdateCertificateDto) {
    const certificate = await this.prisma.certificate.update({
      where: { id: certificateId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.issuer !== undefined ? { issuer: dto.issuer } : {}),
        ...(dto.referenceNo !== undefined ? { referenceNo: dto.referenceNo } : {}),
        ...(dto.documentUrl !== undefined ? { documentUrl: dto.documentUrl } : {}),
        ...(dto.issuedAt !== undefined ? { issuedAt: dto.issuedAt } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt } : {}),
      },
      include: certificateInclude,
    });
    return this.toCertificate(certificate);
  }

  async removeMyCertificate(certificateId: string): Promise<{ success: true }> {
    await this.prisma.certificate.delete({ where: { id: certificateId } });
    return { success: true };
  }

  private async findWorkerProfile(userId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    let reputation;
    if (this.reviewsService) {
      reputation = await this.reviewsService.getWorkerReputation(userId);
    } else {
      reputation = {
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      };
    }
    return { worker, reputation };
  }

  private async findWorker(userId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker profile is not available');
    return worker;
  }

  private toProfile(input: {
    worker: Awaited<ReturnType<WorkersService['findWorkerProfile']>>['worker'];
    reputation: Awaited<ReturnType<WorkersService['findWorkerProfile']>>['reputation'];
  }) {
    const { worker, reputation } = input;
    const completionFields = [
      Boolean(worker.fullName),
      Boolean(worker.profilePhotoUrl),
      Boolean(worker.bio),
      Boolean(worker.location),
      worker.yearsExperience !== null || worker.experiences.length > 0,
      worker.availability !== null,
      worker.languages.length > 0,
      worker.skills.length > 0,
    ];
    return {
      id: worker.id,
      fullName: worker.fullName,
      profilePhotoUrl: worker.profilePhotoUrl,
      bio: worker.bio,
      location: worker.location,
      yearsExperience: worker.yearsExperience,
      availability: worker.availability,
      languages: worker.languages,
      education:
        worker.educationQualification || worker.educationInstitution || worker.educationYear
          ? {
              qualification: worker.educationQualification,
              institution: worker.educationInstitution,
              year: worker.educationYear,
            }
          : null,
      skillCount: worker.skills.length,
      experienceCount: worker.experiences.length,
      profileCompletion: Math.round(
        (completionFields.filter(Boolean).length / completionFields.length) * 100,
      ),
      reputation,
    };
  }

  private toSkill(workerSkill: WorkerSkillWithDetails) {
    const latestVerification = workerSkill.verifications[0] ?? null;
    return {
      id: workerSkill.id,
      skill: workerSkill.skill,
      proficiency: workerSkill.proficiency,
      experienceYears: workerSkill.experienceYears,
      experienceSummary: workerSkill.experienceSummary,
      evidenceReference: workerSkill.evidenceReference,
      verificationStatus: workerSkill.verificationStatus,
      verificationRequestedAt: workerSkill.verificationRequestedAt,
      verifiedAt: workerSkill.verifiedAt,
      certificateCount: workerSkill._count.certificates,
      evidenceCount: workerSkill._count.evidence,
      latestVerification: latestVerification
        ? {
            id: latestVerification.id,
            status: latestVerification.status,
            method: latestVerification.method,
            note: latestVerification.notes,
            evidenceReference: latestVerification.evidenceReference,
            assessmentReference: latestVerification.assessmentReference,
            requestedAt: latestVerification.requestedAt,
            reviewedAt: latestVerification.reviewedAt,
          }
        : null,
    };
  }

  private toCertificate(certificate: CertificateWithDetails) {
    return {
      id: certificate.id,
      skill: certificate.workerSkill.skill,
      title: certificate.title,
      issuer: certificate.issuer,
      referenceNo: certificate.referenceNo,
      documentUrl: certificate.documentUrl,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      status: certificate.status,
      submittedAt: certificate.submittedAt,
      reviewedAt: certificate.reviewedAt,
      reviewNotes: certificate.reviewNotes,
    };
  }

  private toExperience(experience: Prisma.WorkerExperienceGetPayload<Record<string, never>>) {
    return {
      id: experience.id,
      title: experience.title,
      organization: experience.organization,
      startDate: experience.startDate,
      endDate: experience.endDate,
      isCurrent: experience.isCurrent,
      description: experience.description,
      relevantSkills: experience.relevantSkills,
    };
  }

  private toEvidence(evidence: EvidenceWithDetails) {
    return {
      id: evidence.id,
      type: evidence.type,
      description: evidence.description,
      referenceUrl: evidence.referenceUrl,
      createdAt: evidence.createdAt,
      skill: evidence.workerSkill.skill,
      experience: evidence.experience,
    };
  }

  private assertExperienceDates(
    startDate: Date | null | undefined,
    endDate: Date | null | undefined,
    isCurrent: boolean,
  ): void {
    if (!isCurrent && startDate && endDate && endDate < startDate) {
      throw new BadRequestException('Experience end date cannot be before its start date');
    }
  }

  private async assertExperienceBelongsToWorker(experienceId: string, workerId: string) {
    const experience = await this.prisma.workerExperience.findFirst({
      where: { id: experienceId, workerId },
      select: { id: true },
    });
    if (!experience) throw new NotFoundException('Experience is not available');
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
