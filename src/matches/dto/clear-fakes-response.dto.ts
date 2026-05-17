import { ApiProperty } from '@nestjs/swagger';

/** Response body for POST /tenant/matches/:id/clear-fakes. */
export class ClearFakesResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Number of fake bookings hard-deleted in this call',
  })
  removed!: number;

  @ApiProperty({
    example: 7,
    description:
      'Total confirmed bookings on the match after the fakes were removed',
  })
  confirmedCount!: number;

  @ApiProperty({
    example: 0,
    description:
      'Total confirmed bookings held by fake users on the match — always 0 after a successful clear',
  })
  fakeBookingsCount!: number;

  @ApiProperty({
    example: 3,
    description:
      'Seats still free by headcount after this call: maxCapacity minus total confirmed bookings. Does not account for any waitlist promotions that may run asynchronously after the response.',
  })
  spotsRemaining!: number;
}
