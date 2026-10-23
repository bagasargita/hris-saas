import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/pagination';
import { normalizeEmail } from '../auth/auth.dto';

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;
export type InvitationStatusFilter = (typeof INVITATION_STATUSES)[number];

export class CreateInvitationDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsUUID()
  roleId!: string;
}

export class ListInvitationsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: INVITATION_STATUSES })
  @IsOptional()
  @IsIn(INVITATION_STATUSES)
  status?: InvitationStatusFilter;
}
