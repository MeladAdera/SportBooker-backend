import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** GET /users/:userId — tenant admin/staff view of a user in the same tenant. */
export class TenantUserDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({
    enum: ['super_admin', 'tenant_admin', 'tenant_staff', 'player'],
  })
  role!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  walletBalance!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
