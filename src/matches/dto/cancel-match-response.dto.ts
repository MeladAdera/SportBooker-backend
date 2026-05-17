import { ApiProperty } from '@nestjs/swagger';

export class CancelMatchResponseDto {
  @ApiProperty({
    description:
      'Total bookings set to cancelled (confirmed refunds + waitlist)',
  })
  cancelledBookings!: number;

  @ApiProperty({
    description: 'Sum of amounts refunded to wallets (confirmed bookings only)',
    example: '31.00',
  })
  refundedAmount!: string;
}
