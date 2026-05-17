import { ApiProperty } from '@nestjs/swagger';

/** Tenant row for admin list (no logo). */
export class AdminTenantListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  cancelCutoffHours!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
