import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'] })
  status!: string;

  @ApiProperty({
    description: 'Amount charged (0 for waitlist)',
    example: '15.50',
  })
  paidAmount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Confirmed slots remaining for others; null when the match has no capacity cap',
    example: 5,
  })
  remainingSpots!: number | null;
}
