import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { trim } from '../auth/auth.dto';

const SLUG_RULE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const SLUG_MESSAGE =
  'slug may contain lowercase letters, numbers and dashes, and cannot start or end with a dash';

export class CreateTenantDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiPropertyOptional({ description: 'Generated from the name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug?: string;
}
