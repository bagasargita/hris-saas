import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION_DEFAULTS, type Paginated, type SortOrder } from '@saas/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: PAGINATION_DEFAULTS.page })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page: number = PAGINATION_DEFAULTS.page;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.maxLimit,
    default: PAGINATION_DEFAULTS.limit,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.maxLimit)
  limit: number = PAGINATION_DEFAULTS.limit;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: SortOrder = 'desc';
}

export class SearchPageQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export function skipTake(query: PageQueryDto): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function paginated<T>(data: T[], total: number, query: PageQueryDto): Paginated<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
