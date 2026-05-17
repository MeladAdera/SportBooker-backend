import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPosition } from '../booking-position';
import { BookingDetailMatchDto } from './booking-detail-match.dto';
import { BookingDetailVenueDto } from './booking-detail-venue.dto';

/** GET /bookings/:bookingId — player (own) or tenant admin/staff. */
export class BookingDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'] })
  status!: string;

  @ApiProperty({ example: '15.50' })
  paidAmount!: string;

  @ApiProperty({ enum: BookingPosition, enumName: 'BookingPosition' })
  position!: BookingPosition;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Set when booking was cancelled',
  })
  cancelledAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Set when a refund was applied (e.g. match cancel)',
  })
  refundedAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      '1-based FIFO queue position when waitlisted; null for confirmed/cancelled',
    example: 2,
  })
  waitlistPosition!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: BookingDetailMatchDto })
  match!: BookingDetailMatchDto;

  @ApiProperty({ type: BookingDetailVenueDto })
  venue!: BookingDetailVenueDto;
}
