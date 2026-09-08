import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { UpdateSkillStatusDto } from './dto/update-skill-status.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * Workers receive the active catalog for selection. Cooperative admins
   * receive the managed view including inactive skills and filters. The role
   * comes from the signed-in user, never from the request body.
   */
  @Get()
  @Authorize({ roles: [UserRole.CUSTOMER, UserRole.WORKER, UserRole.COOPERATIVE_ADMIN] })
  async listSkills(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('active') active?: string,
  ) {
    if (user.role === UserRole.COOPERATIVE_ADMIN) {
      return this.skillsService.listForAdmin({
        search: search || undefined,
        categoryId: categoryId || undefined,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
      });
    }
    return this.skillsService.listActiveForSelection();
  }

  @Get('categories')
  @Authorize({ roles: [UserRole.CUSTOMER, UserRole.WORKER, UserRole.COOPERATIVE_ADMIN] })
  async listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.skillsService.listCategories(user.role === UserRole.COOPERATIVE_ADMIN);
  }

  @Post()
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  createSkill(@Body() dto: CreateSkillDto) {
    return this.skillsService.createSkill(dto);
  }

  @Patch(':skillId')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  updateSkill(@Param('skillId') skillId: string, @Body() dto: UpdateSkillDto) {
    return this.skillsService.updateSkill(skillId, dto);
  }

  @Patch(':skillId/status')
  @Authorize({ roles: [UserRole.COOPERATIVE_ADMIN] })
  updateSkillStatus(@Param('skillId') skillId: string, @Body() dto: UpdateSkillStatusDto) {
    return this.skillsService.setSkillStatus(skillId, dto.active);
  }
}
