import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

/** API status: `waitlisted` corresponds to DB `pending`. */
export class MyBookingItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'ID of the match this booking belongs to' })
  matchId!: string;

  @ApiProperty({
    enum: ['waitlisted', 'confirmed', 'cancelled'],
    description: 'Waitlisted = on waitlist (pending in DB)',
  })
  status!: string;

  @ApiProperty({ example: '15.50' })
  paidAmount!: string;

  @ApiProperty()
  matchTitle!: string;

  @ApiProperty({ enum: VenueSportType })
  sportType!: VenueSportType;

  @ApiProperty({ example: '2026-12-15T19:00:00.000Z' })
  matchScheduledAt!: string;

  @ApiProperty()
  venueName!: string;

  @ApiProperty({
    description: 'Venue cover image URL; empty string when none',
  })
  venuePictureUrl!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;
}
