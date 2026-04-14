import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPosition } from '../../bookings/booking-position';

export class OperatorWaitlistEntryDto {
  @ApiProperty({ format: 'uuid', description: 'Booking ID' })
  bookingId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiProperty({ enum: BookingPosition, enumName: 'BookingPosition' })
  position!: BookingPosition;

  @ApiProperty({
    description: 'Amount charged on waitlist join',
    example: '15.50',
  })
  paidAmount!: string;

  @ApiProperty({ description: '1-based FIFO queue position' })
  queuePosition!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt!: string;
}
