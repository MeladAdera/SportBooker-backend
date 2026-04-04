import { ApiProperty } from '@nestjs/swagger';

/** POST /matches/:matchId/bookings/:bookingId/cancel — player self-cancel. */
export class CancelPlayerBookingResponseDto {
  @ApiProperty({ example: true })
  cancelled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  cancelledAt!: string;

  @ApiProperty({
    description:
      'Full refund for prepaid waitlist; "0.00" for confirmed bookings (no refund) or legacy unpaid waitlist',
    example: '0.00',
  })
  refundAmount!: string;
}
