import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { AdminTenantListItemDto } from './dto/admin-tenant-list-item.dto';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import type { PaginatedTenantsListDto } from './dto/paginated-tenants-list.dto';
import type { TenantPublicInfoDto } from './dto/tenant-public-info.dto';
import type { TenantResponseDto } from './dto/tenant-response.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import { RESERVED_SLUGS } from '../common/constants/reserved-slugs';
import {
  DEFAULT_CANCEL_CUTOFF_HOURS,
  DEFAULT_TENANT_TIMEZONE,
} from './tenants.constants';
import { invalidateTenantCache } from '../tenant/tenant.middleware';
import type { TenantAdminListRow, TenantRow } from './tenants.repository';
import { TenantsRepository } from './tenants.repository';
import { UsersRepository } from '../users/users.repository';
import { PaymentsService } from '../payments/payments.service';
import { CryptoService } from '../common/crypto/crypto.service';

const PG_UNIQUE_VIOLATION = '23505';
const BCRYPT_ROUNDS = 12;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly paymentsService: PaymentsService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getPublicTenantInfo(tenantId: string): Promise<TenantPublicInfoDto> {
    const row = await this.tenantsRepository.findTenantById(tenantId);
    if (!row) {
      throw new NotFoundException(`Tenant not found`);
    }
    return {
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
    };
  }

  async getTenantByIdForAdmin(tenantId: string): Promise<TenantResponseDto> {
    const row = await this.tenantsRepository.findTenantById(tenantId);
    if (!row) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }
    return this.toResponseDto(row);
  }

  async deactivateTenantForAdmin(
    tenantId: string,
  ): Promise<{ message: string }> {
    const tenant = await this.tenantsRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }

    if (!tenant.is_active) {
      return { message: 'Tenant deactivated' };
    }

    const updated = await this.tenantsRepository.deactivateTenantById(tenantId);
    if (!updated) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }
    invalidateTenantCache(updated.slug);
    return { message: 'Tenant deactivated' };
  }

  async activateTenantForAdmin(tenantId: string): Promise<{ message: string }> {
    const tenant = await this.tenantsRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }

    if (tenant.is_active) {
      return { message: 'Tenant activated' };
    }

    const updated = await this.tenantsRepository.activateTenantById(tenantId);
    if (!updated) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }
    invalidateTenantCache(updated.slug);
    return { message: 'Tenant activated' };
  }

  async updateTenantForAdmin(
    tenantId: string,
    dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    const existing = await this.tenantsRepository.findTenantById(tenantId);
    if (!existing) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }

    const patch: {
      name?: string;
      logoUrl?: string | null;
      timezone?: string;
      cancelCutoffHours?: number;
    } = {};

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.logoUrl !== undefined) patch.logoUrl = dto.logoUrl;
    if (dto.timezone !== undefined) patch.timezone = dto.timezone;
    if (dto.cancelCutoffHours !== undefined)
      patch.cancelCutoffHours = dto.cancelCutoffHours;

    let updatedRow: TenantRow | null = existing;

    if (Object.keys(patch).length > 0) {
      updatedRow = await this.tenantsRepository.updateTenantById(
        tenantId,
        patch,
      );
      if (!updatedRow) {
        throw new NotFoundException(`Tenant "${tenantId}" not found`);
      }
    }

    if (dto.ziinaAccessToken !== undefined) {
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const encryptedToken = this.cryptoService.encrypt(dto.ziinaAccessToken);
      await this.tenantsRepository.updateZiinaCredentials(
        tenantId,
        encryptedToken,
        webhookSecret,
      );
      // Registers the webhook URL with Ziina (throws UnprocessableEntityException on failure)
      await this.paymentsService.registerWebhookForTenant(tenantId);
    }

    return this.toResponseDto(updatedRow);
  }

  async listTenantsForAdmin(
    query: ListTenantsQueryDto,
  ): Promise<PaginatedTenantsListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const isActiveFilter = query.isActive === undefined ? null : query.isActive;

    const [total, rows] = await Promise.all([
      this.tenantsRepository.countTenantsForAdmin(isActiveFilter),
      this.tenantsRepository.findTenantsForAdmin({
        limit,
        offset,
        isActiveFilter,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((row) => this.toAdminListItem(row)),
    };
  }

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

    const passwordHash = await bcrypt.hash(
      dto.superAdmin.password,
      BCRYPT_ROUNDS,
    );

    try {
      return await this.tenantsRepository.withTransaction(async (client) => {
        const tenantRow =
          await this.tenantsRepository.insertTenantWithinTransaction(client, {
            name: dto.name,
            slug,
            logoUrl: dto.logoUrl ?? null,
            timezone,
            cancelCutoffHours,
          });

        await this.usersRepository.insertSuperAdminWithinTransaction(client, {
          tenantId: tenantRow.id,
          name: dto.superAdmin.name,
          email: dto.superAdmin.email,
          passwordHash,
        });

        return this.toResponseDto(tenantRow);
      });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Tenant slug "${slug}" is already in use, or the super admin email already exists in this tenant`,
        );
      }
      throw err;
    }
  }

  private toAdminListItem(row: TenantAdminListRow): AdminTenantListItemDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.is_active,
      timezone: row.timezone,
      cancelCutoffHours: row.cancel_cutoff_hours,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toResponseDto(row: TenantRow): TenantResponseDto {
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
