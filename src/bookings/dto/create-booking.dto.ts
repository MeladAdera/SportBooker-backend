import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BookingPosition } from '../booking-position';

export class CreateBookingDto {
  @ApiPropertyOptional({
    enum: BookingPosition,
    enumName: 'BookingPosition',
    default: BookingPosition.FieldPlayer,
    description:
      'Playing role. At most two confirmed goalkeepers per match; extra goalkeeper requests join the waitlist.',
  })
  @IsOptional()
  @IsEnum(BookingPosition)
  position?: BookingPosition;
}
