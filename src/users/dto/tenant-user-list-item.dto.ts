import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description:
      'Ban expiry; null = permanent (only set when isBanned is true)',
  })
  bannedUntil!: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;
}
