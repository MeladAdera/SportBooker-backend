import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { VenueSportType } from '../venue-sport-type';

/** Partial update — send only fields to change. */
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
    nullable: true,
    description: 'Set to null to clear the venue image URL',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  pictureUrl?: string | null;

  @ApiPropertyOptional({ enum: VenueSportType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(VenueSportType, { each: true })
  sportTypes?: VenueSportType[];

  @ApiPropertyOptional({ description: 'Soft-disable or re-enable the venue' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
