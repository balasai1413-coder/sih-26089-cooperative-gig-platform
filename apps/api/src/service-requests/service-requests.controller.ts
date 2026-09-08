import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { ServiceRequestsService } from './service-requests.service';

@Controller('customers/me/service-requests')
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @Authorize({ roles: [UserRole.CUSTOMER] })
  createRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceRequestDto) {
    return this.serviceRequestsService.createRequest(user, dto);
  }

  @Get()
  @Authorize({ roles: [UserRole.CUSTOMER] })
  listMyRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.serviceRequestsService.listMyRequests(user);
  }

  @Get(':requestId')
  @Authorize({ roles: [UserRole.CUSTOMER] })
  getMyRequest(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string) {
    return this.serviceRequestsService.getMyRequest(user, requestId);
  }

  @Patch(':requestId')
  @Authorize({ roles: [UserRole.CUSTOMER] })
  updateMyRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateServiceRequestDto,
  ) {
    return this.serviceRequestsService.updateMyRequest(user, requestId, dto);
  }

  @Delete(':requestId')
  @Authorize({ roles: [UserRole.CUSTOMER] })
  cancelMyRequest(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string) {
    return this.serviceRequestsService.cancelMyRequest(user, requestId);
  }
}
