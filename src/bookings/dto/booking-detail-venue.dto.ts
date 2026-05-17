import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueSportType } from '../../venues/venue-sport-type';

/** Venue snapshot on booking detail. */
export class BookingDetailVenueDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ description: 'Directions / map link' })
  mapsUrl!: string;

  @ApiProperty({ enum: VenueSportType, isArray: true })
  sportTypes!: VenueSportType[];

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  pictureUrl!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
