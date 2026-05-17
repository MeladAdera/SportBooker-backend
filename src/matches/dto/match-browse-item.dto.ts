import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
    description:
      'Empty seats by headcount: maxCapacity minus all confirmed bookings (real and fake).',
  })
  spotsRemaining!: number;

  @ApiProperty({ description: 'Number of players on the waitlist' })
  waitlistCount!: number;

  @ApiProperty({ example: 'upcoming' })
  status!: string;

  @ApiProperty()
  venueName!: string;

  @ApiProperty({
    description: 'Venue cover image URL; empty string when none',
  })
  venuePictureUrl!: string;

  @ApiPropertyOptional({
    description:
      'True when this is a demo match seeded with fake players. ' +
      'ONLY returned for tenant_staff / tenant_admin / super_admin callers. ' +
      'Players never see this field.',
    example: false,
  })
  isFake?: boolean;
}
