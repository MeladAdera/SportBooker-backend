import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { VenueSportType } from '../venue-sport-type';

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
      'Optional image URL (link). To upload a file from the device instead, use POST /venues/upload with multipart/form-data.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  pictureUrl?: string;

  @ApiProperty({
    enum: VenueSportType,
    isArray: true,
    example: [VenueSportType.Football, VenueSportType.Padel],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(VenueSportType, { each: true })
  sportTypes!: VenueSportType[];
}
