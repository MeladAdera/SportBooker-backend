import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

export class MatchBrowseItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: VenueSportType })
  sportType!: VenueSportType;

  @ApiProperty({ example: '2026-06-01T18:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty()
  durationMins!: number;

  @ApiProperty()
  pricePerPlayer!: number;

  @ApiProperty()
  maxCapacity!: number;

  @ApiProperty({
    description: 'maxCapacity minus confirmed bookings',
  })
  spotsRemaining!: number;

  @ApiProperty({ example: 'upcoming' })
  status!: string;

  @ApiProperty()
  venueName!: string;
}
