import { ApiProperty } from '@nestjs/swagger';

/** Response body for POST /tenant/matches/:id/auto-fill-fake. */
export class AutoFillFakeMatchResponseDto {
  @ApiProperty({
    example: 5,
    description: 'Number of fake bookings created in this call',
  })
  filled!: number;

  @ApiProperty({
    example: 17,
    description: 'Total confirmed bookings on the match after auto-fill',
  })
  confirmedCount!: number;

  @ApiProperty({
    example: 17,
    description:
      'Total confirmed bookings held by fake users on the match after auto-fill',
  })
  fakeBookingsCount!: number;

  @ApiProperty({
    example: 5,
    description:
      'Free seats reserved for real players (maxCapacity minus confirmedCount, ' +
      'so it can drop to 0 once all real seats are taken too)',
  })
  spotsRemaining!: number;
}
