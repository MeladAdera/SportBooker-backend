import { ApiProperty } from '@nestjs/swagger';
import { VenueSportType } from '../venue-sport-type';

/** Public venue card for players browsing venues (no tenant id, picture, or timestamps). */
export class VenueBrowseItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  mapsUrl!: string;

  @ApiProperty({ enum: VenueSportType, isArray: true })
  sportTypes!: VenueSportType[];

  @ApiProperty()
  isActive!: boolean;
}
