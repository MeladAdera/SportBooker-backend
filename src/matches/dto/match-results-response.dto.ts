import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchSide } from './submit-match-results.dto';

export class PlayerStatItemDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: MatchSide })
  teamSide!: MatchSide;

  @ApiProperty()
  goals!: number;

  @ApiProperty()
  assists!: number;

  @ApiProperty()
  isMvp!: boolean;
}

export class MatchResultsResponseDto {
  @ApiProperty()
  matchId!: string;

  @ApiPropertyOptional({ enum: MatchSide, nullable: true })
  winningSide!: MatchSide | null;

  @ApiProperty({ type: () => [PlayerStatItemDto] })
  players!: PlayerStatItemDto[];

  @ApiProperty()
  submittedBy!: string;

  @ApiProperty()
  createdAt!: string;
}
