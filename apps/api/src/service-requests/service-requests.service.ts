import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';

const requestInclude = {
  skill: { select: { id: true, name: true, active: true } },
} satisfies Prisma.ServiceRequestInclude;

type ServiceRequestWithSkill = Prisma.ServiceRequestGetPayload<{ include: typeof requestInclude }>;

@Injectable()
export class ServiceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the Customer record from the authenticated user. The customer id
   * always comes from persisted data keyed by the signed-in user id — never
   * from the request body or route.
   */
  private async resolveCustomerId(user: AuthenticatedUser): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile is not available');
    }
    return customer.id;
  }

  private async getOwnedRequest(customerId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, customerId },
      include: requestInclude,
    });
    if (!request) {
      throw new NotFoundException('Service request is not available');
    }
    return request;
  }

  private toResponse(request: ServiceRequestWithSkill) {
    return {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status,
      location: request.location,
      preferredDateTime: request.preferredDateTime,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      skill: request.skill ? { id: request.skill.id, name: request.skill.name } : null,
    };
  }

  async createRequest(user: AuthenticatedUser, dto: CreateServiceRequestDto) {
    const customerId = await this.resolveCustomerId(user);

    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
      select: { id: true, active: true },
    });
    if (!skill || !skill.active) {
      throw new NotFoundException('Skill is not available in the catalog');
    }

    const request = await this.prisma.serviceRequest.create({
      data: {
        customerId,
        skillId: skill.id,
        title: dto.title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        preferredDateTime: dto.preferredDateTime ? new Date(dto.preferredDateTime) : null,
      },
      include: requestInclude,
    });
    return this.toResponse(request);
  }

  async listMyRequests(user: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(user);
    const requests = await this.prisma.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    });
    return requests.map((request) => this.toResponse(request));
  }

  async getMyRequest(user: AuthenticatedUser, requestId: string) {
    const customerId = await this.resolveCustomerId(user);
    return this.toResponse(await this.getOwnedRequest(customerId, requestId));
  }

  async updateMyRequest(user: AuthenticatedUser, requestId: string, dto: UpdateServiceRequestDto) {
    const customerId = await this.resolveCustomerId(user);
    await this.getOwnedRequest(customerId, requestId);

    const request = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.preferredDateTime !== undefined
          ? {
              preferredDateTime: dto.preferredDateTime ? new Date(dto.preferredDateTime) : null,
            }
          : {}),
      },
      include: requestInclude,
    });
    return this.toResponse(request);
  }

  async cancelMyRequest(user: AuthenticatedUser, requestId: string) {
    const customerId = await this.resolveCustomerId(user);
    const existing = await this.getOwnedRequest(customerId, requestId);

    if (existing.status === ServiceRequestStatus.CLOSED) {
      throw new NotFoundException('Service request is not available');
    }

    const request = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.CANCELLED },
      include: requestInclude,
    });
    return this.toResponse(request);
  }
}
