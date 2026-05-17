import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

export class OperatorMatchItemDto {
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
    example: 'upcoming',
    description: 'Computed: upcoming | in_progress | completed | cancelled',
  })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  venueId!: string;

  @ApiProperty()
  venueName!: string;

  @ApiProperty({ description: 'Number of confirmed bookings' })
  confirmedCount!: number;

  @ApiProperty({ description: 'Number of waitlisted bookings' })
  waitlistCount!: number;

  @ApiProperty({
    description:
      'Headcount: maxCapacity minus all confirmed bookings (real and fake).',
  })
  spotsRemaining!: number;

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

  @ApiProperty({
    description:
      'Number of confirmed bookings held by fake players. Always 0 for non-fake matches.',
    example: 0,
  })
  fakeBookingsCount!: number;

  @ApiProperty({ example: '2026-05-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-10T12:00:00.000Z' })
  updatedAt!: string;
}
