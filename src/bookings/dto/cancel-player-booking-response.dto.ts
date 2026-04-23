import { ApiProperty } from '@nestjs/swagger';

/** POST /matches/:matchId/bookings/:bookingId/cancel — player self-cancel. */
export class CancelPlayerBookingResponseDto {
  @ApiProperty({ example: true })
  cancelled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  cancelledAt!: string;

  @ApiProperty({
    description:
      'Prepaid waitlist cancel: full paid_amount. Confirmed cancel: paid_amount refunded only if outside tenant cancel_cutoff_hours; otherwise "0.00". Unpaid waitlist: "0.00".',
    example: '0.00',
  })
  refundAmount!: string;
}
