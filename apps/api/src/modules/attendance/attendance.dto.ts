import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SearchPageQueryDto } from '../../common/pagination/pagination';

export class CreateAttendanceSiteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(50_000)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAttendanceSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(50_000)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WorkScheduleDayInputDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  startMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  endMinutes!: number;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}

export class PutWorkScheduleDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayInputDto)
  days!: WorkScheduleDayInputDto[];
}

/** Apply one weekly template to many memberships at once. */
export class BulkPutWorkScheduleDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  membershipIds!: string[];

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayInputDto)
  days!: WorkScheduleDayInputDto[];
}

export class ClockInDto {
  @IsUUID()
  siteId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ClockOutDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveAttendanceDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ListAttendanceRecordsQueryDto extends SearchPageQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['OPEN', 'PENDING', 'APPROVED', 'REJECTED'])
  status?: 'OPEN' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ enum: ['self', 'team', 'all'], default: 'self' })
  @IsOptional()
  @IsIn(['self', 'team', 'all'])
  scope: 'self' | 'team' | 'all' = 'self';

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  membershipId?: string;
}

export class AttendanceCalendarQueryDto {
  @ApiProperty({ description: 'Month as YYYY-MM' })
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  month!: string;

  @ApiPropertyOptional({ enum: ['self', 'team', 'all'], default: 'self' })
  @IsOptional()
  @IsIn(['self', 'team', 'all'])
  scope: 'self' | 'team' | 'all' = 'self';
}
