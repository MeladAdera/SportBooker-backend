import { ApiProperty } from '@nestjs/swagger';
import { TenantUserListItemDto } from './tenant-user-list-item.dto';

export class PaginatedTenantUsersDto {
  @ApiProperty({ type: [TenantUserListItemDto] })
  items!: TenantUserListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
