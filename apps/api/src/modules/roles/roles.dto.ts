import { ALL_PERMISSIONS, type PermissionKey } from '@saas/contracts';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../auth/auth.dto';

export class CreateRoleDto {
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  name!: string;

  /** Optional stable key; derived from the name when omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,39}$/, {
    message: 'key must be 2-40 lowercase letters, numbers or dashes',
  })
  key?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: PermissionKey[];
}

export class UpdateRoleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: PermissionKey[];
}
