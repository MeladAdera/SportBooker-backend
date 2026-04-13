import { ApiProperty } from '@nestjs/swagger';
import { OperatorMatchItemDto } from './operator-match-item.dto';

export class PaginatedOperatorMatchesDto {
  @ApiProperty({ type: [OperatorMatchItemDto] })
  items!: OperatorMatchItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
