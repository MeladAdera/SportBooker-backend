import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const FAKE_PLAYERS_BULK_MAX = 200;

/** POST /admin/fake-players/bulk — generate up to {FAKE_PLAYERS_BULK_MAX} fake players in one call. */
export class BulkCreateFakePlayersDto {
  @ApiProperty({
    minimum: 1,
    maximum: FAKE_PLAYERS_BULK_MAX,
    example: 25,
    description: `Number of fake players to generate. Capped at ${FAKE_PLAYERS_BULK_MAX} per call.`,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FAKE_PLAYERS_BULK_MAX)
  count!: number;

  @ApiPropertyOptional({
    description:
      'Seed value to make the generated batch deterministic (useful for tests).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number;
}
