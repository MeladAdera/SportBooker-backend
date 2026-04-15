import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** GET /users/:userId — tenant admin/staff view of a user in the same tenant. */
export class TenantUserDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({
    type: String,
    example: '+963998163901',
    description: 'E.164 format. Omitted when not set.',
  })
  phone?: string;

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
