import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { FederationMembershipStatus, UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AddCooperativeDto } from './dto/add-cooperative.dto';
import { CreateFederationDto } from './dto/create-federation.dto';
import { UpdateFederationDto } from './dto/update-federation.dto';
import { FederationsService } from './federations.service';

@Controller('federations')
export class FederationsController {
  constructor(private readonly federationsService: FederationsService) {}

  @Post()
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFederationDto) {
    return this.federationsService.create(user, dto);
  }

  @Get('me')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.federationsService.listMine(user);
  }

  @Get(':federationId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.get(user, federationId);
  }

  @Patch(':federationId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
    @Body() dto: UpdateFederationDto,
  ) {
    return this.federationsService.update(user, federationId, dto);
  }

  @Get(':federationId/cooperatives')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  listCooperatives(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.listCooperatives(user, federationId);
  }

  @Post(':federationId/cooperatives')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  addCooperative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
    @Body() dto: AddCooperativeDto,
  ) {
    return this.federationsService.addCooperative(user, federationId, dto.cooperativeId);
  }

  @Patch(':federationId/cooperatives/:cooperativeId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  updateMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
    @Param('cooperativeId', ParseUUIDPipe) cooperativeId: string,
    @Body('status') status: FederationMembershipStatus,
  ) {
    return this.federationsService.updateMembership(user, federationId, cooperativeId, status);
  }

  @Post(':federationId/cooperatives/:cooperativeId/approve')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
    @Param('cooperativeId', ParseUUIDPipe) cooperativeId: string,
  ) {
    return this.federationsService.updateMembership(
      user,
      federationId,
      cooperativeId,
      FederationMembershipStatus.ACTIVE,
    );
  }

  @Post(':federationId/cooperatives/:cooperativeId/suspend')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
    @Param('cooperativeId', ParseUUIDPipe) cooperativeId: string,
  ) {
    return this.federationsService.updateMembership(
      user,
      federationId,
      cooperativeId,
      FederationMembershipStatus.SUSPENDED,
    );
  }

  @Get(':federationId/analytics/workforce')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  workforce(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.workforce(user, federationId);
  }

  @Get(':federationId/analytics/demand')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  demand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.demand(user, federationId);
  }

  @Get(':federationId/analytics/welfare')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  welfare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.welfare(user, federationId);
  }

  @Get(':federationId/analytics/performance')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  performance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('federationId', ParseUUIDPipe) federationId: string,
  ) {
    return this.federationsService.performance(user, federationId);
  }
}
