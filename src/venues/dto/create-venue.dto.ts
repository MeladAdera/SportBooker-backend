import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateVenueDto {
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
    example: 'https://cdn.example.com/venues/abc.jpg',
    description:
      'Optional image URL. Omit if uploading a file via the `picture` field.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  pictureUrl?: string;

  @ApiProperty({
    description: 'JSON array string, e.g. ["football","padel"]',
    example: '["football","padel"]',
  })
  @IsString()
  @Length(2, 500)
  sportTypes!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Optional image file (JPEG, PNG, WebP, GIF), max 5 MB. Takes priority over pictureUrl.',
  })
  picture?: unknown;
}
