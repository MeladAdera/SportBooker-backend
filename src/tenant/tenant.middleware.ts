import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { DB_POOL } from '../database/database.constants';

/**
 * Extracts subdomain from Host by stripping APP_DOMAIN suffix.
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
    const host = req.get('X-Forwarded-Host') || req.get('Host') || '';
    const appDomain = this.config.getOrThrow<string>('APP_DOMAIN');

    const subdomain = extractSubdomain(host, appDomain);

    if (!subdomain) {
      throw new BadRequestException('Missing or invalid subdomain');
    }

    const { rows } = await this.pool.query<TenantRow>(
      'SELECT id, name, slug, is_active, created_at, updated_at FROM tenants WHERE slug = $1',
      [subdomain],
    );

    const row = rows[0];
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
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    next();
  }
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
