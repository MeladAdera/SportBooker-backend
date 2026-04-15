import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';
import { E164_STRING_REGEX } from '../../auth/register-phone.util';

/** PATCH /users/me — only these fields; others stripped by ValidationPipe whitelist. */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    description:
      'New email (unique per tenant). Stored normalized (trimmed, lowercased).',
    example: 'john@acfc.test',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'E.164 international format: leading +, then 2–15 digits. Omit to leave unchanged.',
    example: '+963998163901',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const t = value.trim();
    return t === '' ? undefined : t;
  })
  @IsString()
  @Matches(E164_STRING_REGEX)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL (https recommended)',
    example: 'https://cdn.example.com/avatars/u1.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  photoUrl?: string;
}
