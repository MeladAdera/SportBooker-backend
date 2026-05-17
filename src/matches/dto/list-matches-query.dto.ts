import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { VenueSportType } from '../../venues/venue-sport-type';
import { MatchSortBy } from '../match-sort-by';

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '' || value === null) {
    return undefined;
  }
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class ListMatchesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VenueSportType })
  @IsOptional()
  @IsEnum(VenueSportType)
  sportType?: VenueSportType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  venueId?: string;

  /** Calendar date in the tenant's local timezone (YYYY-MM-DD). */
  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @MinLength(10)
  @MaxLength(10)
  date?: string;

  @ApiPropertyOptional({
    description:
      'If true, only matches with at least one spot left (confirmed bookings)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    enum: MatchSortBy,
    default: MatchSortBy.ScheduledAtAsc,
    description: 'Sort order applied server-side before pagination.',
  })
  @IsOptional()
  @IsEnum(MatchSortBy)
  sortBy?: MatchSortBy;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'ISO weekday filter: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun. ' +
      'Multiple values are ORed. Uses the tenant timezone.',
    example: [6, 7],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    // Repeated params (?dayOfWeek=6&dayOfWeek=7) or comma-separated (?dayOfWeek=6,7)
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? `${value}`.split(',')
        : [];
    return raw.map((v) => parseInt(String(v).trim(), 10));
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  dayOfWeek?: number[];
}
