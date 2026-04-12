import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';
import { MatchRosterPlayerDto } from './match-roster-player.dto';

/** Match detail: create response fields plus venue fields, spots, confirmed roster. */
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
    description: 'maxCapacity minus confirmed bookings',
  })
  spotsRemaining!: number;

  @ApiProperty({
    type: [MatchRosterPlayerDto],
    description: 'Confirmed bookings only; pending (waitlist) excluded',
  })
  roster!: MatchRosterPlayerDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
