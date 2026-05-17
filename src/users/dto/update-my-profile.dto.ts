import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { E164_STRING_REGEX } from '../../auth/register-phone.util';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from '../player-profile.enums';

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

  @ApiPropertyOptional({
    description: 'Date of birth in ISO 8601 format (YYYY-MM-DD)',
    example: '1995-03-20',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Nationality (e.g. "Emirati", "British")',
    maxLength: 100,
    example: 'Emirati',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Preferred language code (BCP-47, e.g. "en", "ar")',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, {
    message:
      'preferredLanguage must be a BCP-47 language tag (e.g. "en", "ar", "en-US")',
  })
  preferredLanguage?: string;

  @ApiPropertyOptional({ enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @ApiPropertyOptional({ enum: PlayerPosition })
  @IsOptional()
  @IsEnum(PlayerPosition)
  preferredPosition?: PlayerPosition;

  @ApiPropertyOptional({ enum: DominantFoot })
  @IsOptional()
  @IsEnum(DominantFoot)
  dominantFoot?: DominantFoot;

  @ApiPropertyOptional({
    description: 'Days of the week the player prefers to play',
    enum: DayOfWeek,
    isArray: true,
    example: ['monday', 'wednesday', 'friday'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  preferredDays?: DayOfWeek[];
}
