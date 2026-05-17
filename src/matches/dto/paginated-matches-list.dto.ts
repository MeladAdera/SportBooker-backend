import { ApiProperty } from '@nestjs/swagger';
import { MatchBrowseItemDto } from './match-browse-item.dto';

export class PaginatedMatchesListDto {
  @ApiProperty({ type: [MatchBrowseItemDto] })
  items!: MatchBrowseItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
