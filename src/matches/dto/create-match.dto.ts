import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
}
