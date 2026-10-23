import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/pagination';

export class AuditLogQueryDto extends PageQueryDto {
  /** Prefix match, e.g. `member.` or `auth.login`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z_.]+$/, {
    message: 'action may only contain lowercase letters, dots and underscores',
  })
  action?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class PlatformAuditLogQueryDto extends AuditLogQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
