import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueSportType } from '../venue-sport-type';

export class VenueResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  address?: string | null;

  @ApiPropertyOptional()
  mapsUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Image URL when the client uploaded a photo to storage and passed the resulting URL.',
  })
  pictureUrl?: string | null;

  @ApiProperty({ enum: VenueSportType, isArray: true })
  sportTypes!: VenueSportType[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
