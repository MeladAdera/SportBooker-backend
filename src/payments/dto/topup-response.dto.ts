import { ApiProperty } from '@nestjs/swagger';

export class TopupResponseDto {
  @ApiProperty({
    description:
      'Ziina-hosted payment page URL — redirect the player here to complete payment',
    example: 'https://pay.ziina.com/payment/abc123',
  })
  redirectUrl!: string;

  @ApiProperty({
    description: 'Your internal payment intent ID',
    example: 'a1b2c3d4-...',
  })
  paymentIntentId!: string;
}
