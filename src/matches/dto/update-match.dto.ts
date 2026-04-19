import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { VenueSportType } from '../../venues/venue-sport-type';
import { IsFutureScheduledAt } from '../is-future-scheduled-at.decorator';

/** Partial update — send only fields to change. */
export class UpdateMatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @ApiPropertyOptional({ enum: VenueSportType })
  @IsOptional()
  @IsEnum(VenueSportType)
  sportType?: VenueSportType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  venueId?: string;

  @ApiPropertyOptional({ example: '2026-04-01T18:00:00.000Z' })
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsDateString()
  @IsFutureScheduledAt()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMins?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @ApiPropertyOptional({ description: 'Whole currency units; must be >= 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pricePerPlayer?: number;

  @ApiPropertyOptional({
    description:
      'Only valid when the match is fake. Reserved real-player seats; ' +
      'must be 0..maxCapacity. Cannot be set on a real (non-fake) match.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRealSpots?: number;
}
