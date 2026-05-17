import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from '../player-profile.enums';
import { PlayerStatsDto } from './player-stats.dto';

/** GET /users/me — current user profile (no sensitive DB fields). */
export class MyProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({
    type: String,
    example: '+963998163901',
    description: 'E.164 format. Omitted when not set.',
  })
  phone?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({
    enum: ['super_admin', 'tenant_admin', 'tenant_staff', 'player'],
  })
  role!: string;

  @ApiProperty({ example: 0 })
  walletBalance!: number;

  // Player profile fields

  @ApiPropertyOptional({ nullable: true, type: String, example: '1995-03-20' })
  dateOfBirth!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Emirati' })
  nationality!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'en' })
  preferredLanguage!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: SkillLevel })
  skillLevel!: SkillLevel | null;

  @ApiPropertyOptional({ nullable: true, enum: PlayerPosition })
  preferredPosition!: PlayerPosition | null;

  @ApiPropertyOptional({ nullable: true, enum: DominantFoot })
  dominantFoot!: DominantFoot | null;

  @ApiProperty({
    description: 'Days of the week the player prefers to play',
    enum: Object.values(DayOfWeek),
    isArray: true,
    example: ['monday', 'friday'],
  })
  preferredDays!: DayOfWeek[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: () => PlayerStatsDto })
  stats!: PlayerStatsDto;
}
