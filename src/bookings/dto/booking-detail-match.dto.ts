import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

/** Match snapshot on booking detail. */
export class BookingDetailMatchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  venueId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: VenueSportType })
  sportType!: VenueSportType;

  @ApiProperty({ example: '2026-04-01T18:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty()
  durationMins!: number;

  @ApiPropertyOptional({ nullable: true })
  maxPlayers!: number | null;

  @ApiProperty({ example: 25.5 })
  pricePerPlayer!: number;

  @ApiProperty({
    enum: ['scheduled', 'upcoming', 'in_progress', 'completed', 'cancelled'],
  })
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
