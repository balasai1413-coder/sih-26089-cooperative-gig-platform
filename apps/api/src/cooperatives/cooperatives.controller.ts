import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize, RequireCooperativeScope } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CooperativesService } from './cooperatives.service';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';

@Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly cooperativesService: CooperativesService) {}

  /**
   * Cooperatives administered by the signed-in user. The list is resolved
   * from persisted admin relationships; the client never supplies scope.
   */
  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.cooperativesService.listMine(user);
  }

  @Get(':cooperativeId')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
  ) {
    return this.cooperativesService.getMine(user, cooperativeId);
  }

  @Patch(':cooperativeId')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Body() dto: UpdateCooperativeDto,
  ) {
    return this.cooperativesService.updateMine(user, cooperativeId, dto);
  }

  @Get(':cooperativeId/members')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'former',
  ) {
    return this.cooperativesService.listMembers(user, cooperativeId, {
      search: search || undefined,
      status: status === 'former' ? 'former' : 'active',
    });
  }

  @Get(':cooperativeId/members/:workerId')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Param('workerId') workerId: string,
  ) {
    return this.cooperativesService.getMember(user, cooperativeId, workerId);
  }
}
