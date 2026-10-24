import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { SearchPageQueryDto } from '../../common/pagination/pagination';

export const MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type MemberStatusValue = (typeof MEMBER_STATUSES)[number];

export class ListMembersQueryDto extends SearchPageQueryDto {
  @ApiPropertyOptional({ enum: MEMBER_STATUSES })
  @IsOptional()
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatusValue;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: ['joinedAt', 'name', 'email'], default: 'joinedAt' })
  @IsOptional()
  @IsIn(['joinedAt', 'name', 'email'])
  sortBy: 'joinedAt' | 'name' | 'email' = 'joinedAt';
}

export class UpdateMemberRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  roleIds!: string[];
}

export class UpdateMemberStatusDto {
  @IsIn(MEMBER_STATUSES)
  status!: MemberStatusValue;
}

export class UpdateMemberManagerDto {
  /** Null clears the reporting line. */
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  managerId!: string | null;
}
