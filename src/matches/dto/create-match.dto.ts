import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { VenueSportType } from '../../venues/venue-sport-type';
import { IsFutureScheduledAt } from '../is-future-scheduled-at.decorator';

export class CreateMatchDto {
  @ApiProperty({ example: 'Sunday league' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ enum: VenueSportType })
  @IsEnum(VenueSportType)
  sportType!: VenueSportType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  venueId!: string;

  @ApiProperty({ example: '2026-04-01T18:00:00.000Z' })
  @IsDateString()
  @IsFutureScheduledAt()
  scheduledAt!: string;

  @ApiProperty({ example: 90 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMins!: number;

  @ApiProperty({ example: 22 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity!: number;

  @ApiProperty({
    example: 15,
    description: 'Whole currency units; must be >= 1',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pricePerPlayer!: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Marks this match as a demo match seeded with fake players. ' +
      'Defaults to false. Real players can still book it normally; ' +
      'fake bookings will be bumped to make space when needed.',
  })
  @IsOptional()
  @IsBoolean()
  isFake?: boolean;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Only meaningful when isFake = true. Minimum number of seats reserved ' +
      'for real players: auto-fill with fake players is capped at ' +
      '(maxCapacity - minRealSpots). Must be between 0 and maxCapacity. Defaults to 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRealSpots?: number;
}
