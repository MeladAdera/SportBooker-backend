import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsIanaTimeZone } from '../decorators/is-iana-timezone.decorator';

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: 'john@acfc.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    },
    {
      message:
        'password must be at least 8 characters with uppercase, lowercase, and a number',
    },
  )
  password!: string;
}

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

  @ApiProperty({
    type: CreateSuperAdminDto,
    description: 'Initial super admin for this tenant',
  })
  @ValidateNested()
  @Type(() => CreateSuperAdminDto)
  superAdmin!: CreateSuperAdminDto;
}
