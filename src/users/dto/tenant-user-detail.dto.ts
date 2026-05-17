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

  @ApiProperty({ description: 'True when the player has an active ban' })
  isBanned!: boolean;

  @ApiProperty({
    description:
      'True when this user is a synthetic fake/demo player (admin-generated). Fake users cannot log in and are excluded from notifications.',
    example: false,
  })
  isFake!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the ban was applied; null if not banned',
  })
  bannedAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Ban expiry; null = permanent (only set when isBanned is true)',
  })
  bannedUntil!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Internal ban reason; null if not banned',
  })
  banReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
