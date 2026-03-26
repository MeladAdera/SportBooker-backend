import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsIanaTimeZone } from '../decorators/is-iana-timezone.decorator';

/** Partial update for admin. Omitted fields are unchanged. */
export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Arena Sports LLC' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set to null to remove the logo URL',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_tld: false })
  logoUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Europe/London',
    description: 'IANA timezone identifier',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimeZone()
  timezone?: string;

  @ApiPropertyOptional({
    example: 24,
    description:
      'Hours before event start when cancellation closes; 0 means no cutoff window',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 365)
  cancelCutoffHours?: number;

  @ApiPropertyOptional({
    description:
      'Slug cannot be changed after creation; sending this returns 400',
  })
  @IsOptional()
  @IsString()
  slug?: string;
}
