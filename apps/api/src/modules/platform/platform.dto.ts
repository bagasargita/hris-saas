import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SearchPageQueryDto } from '../../common/pagination/pagination';

const STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
type Status = (typeof STATUSES)[number];

export class PlatformListQueryDto extends SearchPageQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: Status;
}

export class UpdateStatusDto {
  @IsIn(STATUSES)
  status!: Status;
}
