import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsIanaTimeZone } from '../decorators/is-iana-timezone.decorator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Arena Sports LLC' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({
    example: 'arena-downtown',
    description: 'Lowercase alphanumeric and hyphens only, max 100 characters',
  })
  @Matches(/^[a-z0-9-]{1,100}$/, {
    message:
      'slug must be 1–100 characters: lowercase letters, digits, and hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'Asia/Dubai',
    description: 'IANA timezone; defaults to Asia/Dubai if omitted',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimeZone()
  timezone?: string;

  @ApiPropertyOptional({
    example: 24,
    description:
      'Hours before event start when cancellation is no longer allowed',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 365)
  cancelCutoffHours?: number;
}
