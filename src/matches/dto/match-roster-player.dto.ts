import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPosition } from '../../bookings/booking-position';

export class MatchRosterPlayerDto {
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
}
