import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { WorkerMatchingService } from './matching.service';

@Controller()
export class WorkerDiscoveryController {
  constructor(private readonly matchingService: WorkerMatchingService) {}

  /**
   * Customer-facing worker discovery for one of their own OPEN service
   * requests. Only verified, eligible workers are returned.
   */
  @Get('customers/me/service-requests/:requestId/matches')
  @Authorize({ roles: [UserRole.CUSTOMER] })
  findMatches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.matchingService.findMatches(user, requestId);
  }

  /**
   * Safe public worker profile. Available to authenticated customers and
   * workers; only marketplace-appropriate information is returned.
   */
  @Get('workers/:workerId/public')
  @Authorize({ roles: [UserRole.CUSTOMER, UserRole.WORKER, UserRole.COOPERATIVE_ADMIN] })
  getPublicWorkerProfile(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.matchingService.getPublicWorkerProfile(workerId);
  }
}
