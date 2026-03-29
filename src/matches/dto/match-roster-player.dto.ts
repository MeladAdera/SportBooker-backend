import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MatchRosterPlayerDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Profile photo URL when set',
  })
  photoUrl!: string | null;
}
