import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response for POST /users/:userId/ban and POST /users/:userId/unban */
export class BanPlayerResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ description: 'Whether the player is currently banned' })
  isBanned!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Timestamp when the ban was applied; null when unbanned',
  })
  bannedAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Ban expiry timestamp; null means permanent',
  })
  bannedUntil!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Internal ban reason; null when unbanned',
  })
  banReason!: string | null;

  @ApiProperty({
    description: 'Number of upcoming bookings that were cancelled and refunded',
  })
  cancelledBookings!: number;
}
