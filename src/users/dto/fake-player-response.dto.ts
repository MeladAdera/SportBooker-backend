import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from '../player-profile.enums';

/** Single fake-player record returned to admin tooling. */
export class FakePlayerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description:
      'Auto-generated synthetic email — `fake+<uuid>@fake.local`. Cannot receive mail.',
  })
  email!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiPropertyOptional({ enum: SkillLevel, nullable: true })
  skillLevel!: SkillLevel | null;

  @ApiPropertyOptional({ enum: PlayerPosition, nullable: true })
  preferredPosition!: PlayerPosition | null;

  @ApiPropertyOptional({ enum: DominantFoot, nullable: true })
  dominantFoot!: DominantFoot | null;

  @ApiProperty({ enum: DayOfWeek, isArray: true })
  preferredDays!: DayOfWeek[];

  @ApiProperty()
  createdAt!: string;
}
