import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { TenantResponseDto } from './dto/tenant-response.dto';
import {
  DEFAULT_CANCEL_CUTOFF_HOURS,
  DEFAULT_TENANT_TIMEZONE,
  RESERVED_SLUGS,
} from './tenants.constants';
import { TenantsRepository } from './tenants.repository';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async createTenant(dto: CreateTenantDto): Promise<TenantResponseDto> {
    const slug = dto.slug;
    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      throw new BadRequestException(
        `Slug "${slug}" is reserved and cannot be used`,
      );
    }

    const timezone = dto.timezone ?? DEFAULT_TENANT_TIMEZONE;
    const cancelCutoffHours =
      dto.cancelCutoffHours ?? DEFAULT_CANCEL_CUTOFF_HOURS;

    try {
      const row = await this.tenantsRepository.insertTenant({
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl ?? null,
        timezone,
        cancelCutoffHours,
      });
      return this.toResponseDto(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(`Tenant slug "${slug}" is already in use`);
      }
      throw err;
    }
  }

  private toResponseDto(row: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    timezone: string;
    cancel_cutoff_hours: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): TenantResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      timezone: row.timezone,
      cancelCutoffHours: row.cancel_cutoff_hours,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
