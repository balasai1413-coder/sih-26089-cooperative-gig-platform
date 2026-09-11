import { IsUUID } from 'class-validator';

export class AddCooperativeDto {
  @IsUUID()
  cooperativeId!: string;
}
