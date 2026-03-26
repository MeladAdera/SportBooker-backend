import { ApiProperty } from '@nestjs/swagger';
import { AdminTenantListItemDto } from './admin-tenant-list-item.dto';

export class PaginatedTenantsListDto {
  @ApiProperty({ type: [AdminTenantListItemDto] })
  items!: AdminTenantListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
