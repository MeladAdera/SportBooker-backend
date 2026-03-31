import { ApiProperty } from '@nestjs/swagger';

/** POST /matches/:matchId/bookings/:bookingId/cancel — player self-cancel (no refund). */
export class CancelPlayerBookingResponseDto {
  @ApiProperty({ example: true })
  cancelled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  cancelledAt!: string;

  @ApiProperty({
    description: 'Always zero for this flow (no refund)',
    example: '0.00',
  })
  refundAmount!: string;
}
