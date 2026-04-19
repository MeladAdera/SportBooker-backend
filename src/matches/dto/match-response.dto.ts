import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

export class MatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: VenueSportType })
  sportType!: VenueSportType;

  @ApiProperty({ format: 'uuid' })
  venueId!: string;

  @ApiProperty({ example: '2026-04-01T18:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty()
  durationMins!: number;

  @ApiProperty()
  maxCapacity!: number;

  @ApiProperty()
  pricePerPlayer!: number;

  @ApiProperty({
    enum: ['scheduled', 'upcoming', 'in_progress', 'completed', 'cancelled'],
  })
  status!: string;

  @ApiProperty({
    description: 'True when this is a demo match seeded with fake players',
    example: false,
  })
  isFake!: boolean;

  @ApiProperty({
    description:
      'Reserved seats for real players (only meaningful when isFake = true). 0 otherwise.',
    example: 0,
  })
  minRealSpots!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
