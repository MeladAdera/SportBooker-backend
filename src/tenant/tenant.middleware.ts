import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/database.constants';
import type { TenantRow } from '../tenants/tenants.repository';

/** Columns loaded by middleware lookup + cache; subset of {@link TenantRow}. */
type TenantMiddlewareRow = Pick<
  TenantRow,
  | 'id'
  | 'name'
  | 'slug'
  | 'timezone'
  | 'cancel_cutoff_hours'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>;

const TENANT_CACHE_TTL_MS = 60_000;

interface CachedTenant {
  data: TenantMiddlewareRow;
  expiresAt: number;
}

const tenantCache = new Map<string, CachedTenant>();

function getCachedTenant(slug: string): TenantMiddlewareRow | null {
  const cached = tenantCache.get(slug);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    tenantCache.delete(slug);
    return null;
  }
  return cached.data;
}

function setCachedTenant(slug: string, data: TenantMiddlewareRow): void {
  tenantCache.set(slug, {
    data,
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
  });
}

/**
 * Call when a tenant is updated to invalidate cached data.
 * Export for use by tenant service when update/delete flows exist.
 */
export function invalidateTenantCache(slug: string): void {
  tenantCache.delete(slug);
}

/**
 * Extracts subdomain from Host by stripping TENANT_HOST_SUFFIX suffix.
 * Handles: acfc.sportbooker.com + sportbooker.com → acfc
 *          acfc.localhost:3000 + localhost:3000 → acfc
 * Requires prefix to end with '.' to avoid matching evil-sportbooker.com.
 */
export function extractSubdomain(
  host: string,
  appDomain: string,
): string | null {
  if (!host || !appDomain) return null;
  const hostLower = host.toLowerCase().trim();
  const domainLower = appDomain.toLowerCase().trim();
  if (!hostLower.endsWith(domainLower)) return null;
  const prefix = hostLower.slice(0, -domainLower.length);
  if (!prefix) return null;
  if (!prefix.endsWith('.')) return null;
  const subdomain = prefix.slice(0, -1);
  return subdomain || null;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const slugHeader = req.get('X-Tenant-Slug')?.trim().toLowerCase();
    const host = req.get('X-Forwarded-Host') || req.get('Host') || '';
    const appDomain = this.config.getOrThrow<string>('TENANT_HOST_SUFFIX');

    const subdomain = slugHeader || extractSubdomain(host, appDomain);

    if (!subdomain) {
      throw new BadRequestException('Missing or invalid subdomain');
    }

    let row = getCachedTenant(subdomain);
    if (!row) {
      const { rows } = await this.pool.query<TenantMiddlewareRow>(
        'SELECT id, name, slug, timezone, cancel_cutoff_hours, is_active, created_at, updated_at FROM tenants WHERE slug = $1',
        [subdomain],
      );
      row = rows[0];
      if (row) {
        setCachedTenant(subdomain, row);
      }
    }
    if (!row) {
      throw new NotFoundException(`Tenant not found: ${subdomain}`);
    }

    if (!row.is_active) {
      throw new ForbiddenException('Tenant is inactive');
    }

    req.tenant = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      cancel_cutoff_hours: row.cancel_cutoff_hours,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    next();
  }
}
