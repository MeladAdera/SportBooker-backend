import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

/**
 * Form fields for POST /venues/upload (multipart). File field `picture` is handled by multer, not here.
 */
export class CreateVenueMultipartDto {
  @ApiProperty({ example: 'North Court 1' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: '1 Stadium Rd, London' })
  @IsString()
  @Length(1, 2000)
  address!: string;

  @ApiProperty({ example: 'https://maps.google.com/?q=...' })
  @IsUrl({ require_tld: false })
  mapsUrl!: string;

  @ApiPropertyOptional({
    description:
      'Image URL if not uploading a file. Do not send together with `picture` file.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  pictureUrl?: string;

  @ApiProperty({
    description: 'JSON array string, e.g. ["football","padel"]',
    example: '["football","padel"]',
  })
  @IsString()
  @Length(2, 500)
  sportTypes!: string;
}
