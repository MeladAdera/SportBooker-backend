import { ApiProperty } from '@nestjs/swagger';
import { FakePlayerResponseDto } from './fake-player-response.dto';

export class BulkCreateFakePlayersResponseDto {
  @ApiProperty({ description: 'How many fake players were inserted.' })
  count!: number;

  @ApiProperty({ type: [FakePlayerResponseDto] })
  players!: FakePlayerResponseDto[];
}
