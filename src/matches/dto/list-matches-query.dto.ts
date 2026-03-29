import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { VenueSportType } from '../../venues/venue-sport-type';

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

  /** Calendar date in UTC matching the date portion of `scheduled_at`. */
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
}
