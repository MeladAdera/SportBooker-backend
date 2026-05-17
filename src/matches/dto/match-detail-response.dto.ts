import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';
import { MatchRosterPlayerDto } from './match-roster-player.dto';
import { MatchWaitlistPlayerDto } from './match-waitlist-player.dto';

/** Match detail: venue fields, spots, confirmed roster, and waitlist. */
export class MatchDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: VenueSportType })
  sportType!: VenueSportType;

  @ApiProperty({ format: 'uuid' })
  venueId!: string;

  @ApiProperty()
  venueName!: string;

  @ApiProperty()
  venueAddress!: string;

  @ApiProperty({
    nullable: true,
    description: 'Venue cover image URL',
  })
  venuePictureUrl!: string;

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
    description:
      'Empty seats by headcount: maxCapacity minus all confirmed bookings (real and fake).',
  })
  spotsRemaining!: number;

  @ApiProperty({
    type: [MatchRosterPlayerDto],
    description: 'Confirmed bookings only',
  })
  roster!: MatchRosterPlayerDto[];

  @ApiProperty({
    type: [MatchWaitlistPlayerDto],
    description: 'Pending (waitlist) bookings ordered by FIFO queue position',
  })
  waitlist!: MatchWaitlistPlayerDto[];

  @ApiProperty({ description: 'Number of players on the waitlist' })
  waitlistCount!: number;

  @ApiPropertyOptional({
    description:
      'True when this is a demo match seeded with fake players. ' +
      'ONLY returned for tenant_staff / tenant_admin / super_admin callers. ' +
      'Players never see this field.',
    example: false,
  })
  isFake?: boolean;

  @ApiPropertyOptional({
    description:
      'Reserved seats for real players (only meaningful when isFake = true). ' +
      'ONLY returned for tenant_staff / tenant_admin / super_admin callers.',
    example: 0,
  })
  minRealSpots?: number;

  @ApiPropertyOptional({
    description:
      'Number of confirmed bookings held by fake players. ' +
      'ONLY returned for tenant_staff / tenant_admin / super_admin callers.',
    example: 0,
  })
  fakeBookingsCount?: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
