import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from '../player-profile.enums';

/** POST /admin/fake-players — single fake-player creation. All fields optional; faker fills the gaps. */
export class CreateFakePlayerDto {
  @ApiPropertyOptional({
    description: 'Display name. Generated when omitted.',
    example: 'Lionel Messi',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Public profile photo URL. A pravatar URL is generated when omitted.',
    example: 'https://i.pravatar.cc/300?u=demo',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  photoUrl?: string;

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
    enum: DayOfWeek,
    isArray: true,
    description: 'Preferred days of the week.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsEnum(DayOfWeek, { each: true })
  preferredDays?: DayOfWeek[];
}
