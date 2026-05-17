import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPosition } from '../../bookings/booking-position';

export class MatchWaitlistPlayerDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: BookingPosition, enumName: 'BookingPosition' })
  position!: BookingPosition;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Profile photo URL when set',
  })
  photoUrl!: string | null;

  @ApiProperty({ description: '1-based FIFO queue position' })
  queuePosition!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the player joined the waitlist',
  })
  joinedAt!: string;
}
