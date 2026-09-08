import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

const skillInclude = {
  category: { select: { id: true, name: true } },
  _count: { select: { workerSkills: true } },
} satisfies Prisma.SkillInclude;

/**
 * The shared skill catalog is platform-wide controlled data. Cooperative
 * admins curate it; workers can only read the active portion for selection.
 * Skills are never deleted because historical worker skills must remain
 * intact — deactivation is the only retirement path.
 */
@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active catalog for worker selection; inactive skills are excluded. */
  async listActiveForSelection() {
    const skills = await this.prisma.skill.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return skills;
  }

  /** Full catalog view for catalog managers, including inactive skills. */
  async listForAdmin(query: { search?: string; categoryId?: string; active?: boolean }) {
    const where: Prisma.SkillWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };
    const skills = await this.prisma.skill.findMany({
      where,
      include: skillInclude,
      orderBy: { name: 'asc' },
    });
    return skills.map((skill) => this.toSkill(skill));
  }

  async listCategories(includeInactive = false) {
    const categories = await this.prisma.skillCategory.findMany({
      where: includeInactive ? {} : { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        _count: { select: { skills: true } },
      },
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => this.toCategory(category));
  }

  async createSkill(dto: CreateSkillDto) {
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    try {
      const skill = await this.prisma.skill.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          categoryId: dto.categoryId ?? null,
          active: true,
        },
        include: skillInclude,
      });
      return this.toSkill(skill);
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('A skill with this name already exists');
      }
      throw error;
    }
  }

  async updateSkill(skillId: string, dto: UpdateSkillDto) {
    const existing = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Skill is not available');
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    try {
      const skill = await this.prisma.skill.update({
        where: { id: skillId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        },
        include: skillInclude,
      });
      return this.toSkill(skill);
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('A skill with this name already exists');
      }
      throw error;
    }
  }

  /** Soft deactivation. Existing worker skills keep their records. */
  async setSkillStatus(skillId: string, active: boolean) {
    const existing = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Skill is not available');
    const skill = await this.prisma.skill.update({
      where: { id: skillId },
      data: { active },
      include: skillInclude,
    });
    return this.toSkill(skill);
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await this.prisma.skillCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Skill category is not available');
  }

  private toSkill(skill: Prisma.SkillGetPayload<{ include: typeof skillInclude }>) {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      active: skill.active,
      category: skill.category,
      workerCount: skill._count.workerSkills,
    };
  }

  private toCategory(
    category: Prisma.SkillCategoryGetPayload<{
      select: {
        id: true;
        name: true;
        description: true;
        active: true;
        _count: { select: { skills: true } };
      };
    }>,
  ) {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      active: category.active,
      skillCount: category._count.skills,
    };
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
