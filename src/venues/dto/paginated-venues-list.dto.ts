import { ApiProperty } from '@nestjs/swagger';
import { VenueBrowseItemDto } from './venue-browse-item.dto';

export class PaginatedVenuesListDto {
  @ApiProperty({ type: [VenueBrowseItemDto] })
  items!: VenueBrowseItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
