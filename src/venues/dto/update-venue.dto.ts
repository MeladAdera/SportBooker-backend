import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Partial update — send only fields to change. Sent as multipart/form-data. */
export class UpdateVenueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  mapsUrl?: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Set to null to clear the venue image URL',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  pictureUrl?: string | null;

  @ApiPropertyOptional({
    description: 'JSON array string, e.g. ["football","padel"]',
    example: '["football","padel"]',
  })
  @IsOptional()
  @IsString()
  @Length(2, 500)
  sportTypes?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Optional image file (JPEG, PNG, WebP, GIF), max 5 MB. Takes priority over pictureUrl.',
  })
  picture?: unknown;
}
