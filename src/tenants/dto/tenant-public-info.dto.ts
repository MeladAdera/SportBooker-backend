import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Public tenant branding info — no auth required. */
export class TenantPublicInfoDto {
  @ApiProperty({ description: 'Tenant display name' })
  name!: string;

  @ApiProperty({ description: 'Tenant slug (subdomain)' })
  slug!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Logo image URL; null when not set',
  })
  logoUrl!: string | null;
}
