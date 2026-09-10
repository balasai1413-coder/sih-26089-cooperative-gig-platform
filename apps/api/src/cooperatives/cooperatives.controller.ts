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

  @Get('me/demand/overview')
  async getMyDemandOverview(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.cooperativesService.getMyDemandOverview(user, Number(days ?? 30));
  }

  @Get('me/demand/by-skill')
  async getMyDemandBySkill(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.cooperativesService.getMyDemandBySkill(user, Number(days ?? 30));
  }

  @Get('me/demand/trends')
  async getMyDemandTrends(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.cooperativesService.getMyDemandTrends(user, Number(days ?? 30));
  }

  @Get('me/demand/forecast')
  async getMyDemandForecast(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.cooperativesService.getMyDemandForecast(user, Number(days ?? 30));
  }

  @Get('me/demand/capacity')
  async getMyDemandCapacity(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    return this.cooperativesService.getMyDemandCapacity(user, Number(days ?? 30));
  }

  @Get('me/demand/recommendations')
  async getMyDemandRecommendations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getMyDemandRecommendations(user, Number(days ?? 30));
  }

  @Get(':cooperativeId')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
  ) {
    return this.cooperativesService.getMine(user, cooperativeId);
  }

  @Get(':cooperativeId/demand/overview')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandOverview(user, cooperativeId, Number(days ?? 30));
  }

  @Get(':cooperativeId/demand/by-skill')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandBySkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandBySkill(user, cooperativeId, Number(days ?? 30));
  }

  @Get(':cooperativeId/demand/trends')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandTrends(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandTrends(user, cooperativeId, Number(days ?? 30));
  }

  @Get(':cooperativeId/demand/forecast')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandForecast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandForecast(user, cooperativeId, Number(days ?? 30));
  }

  @Get(':cooperativeId/demand/capacity')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandCapacity(user, cooperativeId, Number(days ?? 30));
  }

  @Get(':cooperativeId/demand/recommendations')
  @RequireCooperativeScope({ scope: 'admin', param: 'cooperativeId' })
  async getDemandRecommendations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cooperativeId') cooperativeId: string,
    @Query('days') days?: string,
  ) {
    return this.cooperativesService.getDemandRecommendations(user, cooperativeId, Number(days ?? 30));
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
