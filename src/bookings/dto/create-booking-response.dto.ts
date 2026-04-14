import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPosition } from '../booking-position';

export class CreateBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'] })
  status!: string;

  @ApiProperty({
    description:
      'Amount charged (match price when confirmed or prepaid waitlist; legacy unpaid waitlist was 0)',
    example: '15.50',
  })
  paidAmount!: string;

  @ApiProperty({ enum: BookingPosition, enumName: 'BookingPosition' })
  position!: BookingPosition;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Confirmed slots remaining for others; null when the match has no capacity cap',
    example: 5,
  })
  remainingSpots!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'When status is pending (waitlist): explains prepaid charge and refund policy',
  })
  waitlistNotice!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      '1-based FIFO queue position when waitlisted; null when confirmed',
    example: 3,
  })
  waitlistPosition!: number | null;
}
