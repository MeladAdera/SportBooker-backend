import { ApiProperty } from '@nestjs/swagger';

export class RemoveFromWaitlistResponseDto {
  @ApiProperty({ example: true })
  removed!: boolean;

  @ApiProperty({
    description:
      'Refunded amount (prepaid waitlist charge); "0.00" for legacy unpaid',
    example: '15.50',
  })
  refundAmount!: string;
}
