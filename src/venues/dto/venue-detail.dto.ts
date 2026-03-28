import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueSportType } from '../venue-sport-type';

/** Single-venue view for players (tenant enforced server-side; no tenantId in body). */
export class VenueDetailDto {
  @ApiProperty()
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

  @ApiPropertyOptional({
    description: 'Venue image URL when set',
  })
  pictureUrl?: string | null;
}
