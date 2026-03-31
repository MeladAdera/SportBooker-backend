import { ApiProperty } from '@nestjs/swagger';

export class TenantUserListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    enum: ['player', 'tenant_staff', 'tenant_admin'],
    description: 'super_admin users are never listed',
  })
  role!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 42.5 })
  walletBalance!: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;
}
