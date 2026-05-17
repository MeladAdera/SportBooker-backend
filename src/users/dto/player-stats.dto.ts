import { ApiProperty } from '@nestjs/swagger';

/** Aggregated player statistics computed from match results. */
export class PlayerStatsDto {
  @ApiProperty({
    example: 12,
    description: 'Total matches with a confirmed booking and submitted results',
  })
  matchesPlayed!: number;

  @ApiProperty({ example: 7 })
  wins!: number;

  @ApiProperty({ example: 3 })
  losses!: number;

  @ApiProperty({ example: 2 })
  draws!: number;

  @ApiProperty({ example: 9 })
  goalsScored!: number;

  @ApiProperty({ example: 4 })
  assists!: number;

  @ApiProperty({ example: 2 })
  mvpAwards!: number;
}
