import { IsBoolean } from 'class-validator';

export class UpdateSkillStatusDto {
  @IsBoolean()
  active!: boolean;
}
