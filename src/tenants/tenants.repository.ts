import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  cancel_cutoff_hours: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

/** Admin tenant list row (no logo). */
export type TenantAdminListRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  cancel_cutoff_hours: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class TenantsRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  /** Full tenant row by primary key; used for admin detail and create response. */
  async findTenantById(id: string): Promise<TenantRow | null> {
    const { rows } = await this.query<TenantRow>(
      this.pool,
      `SELECT id, name, slug, logo_url, timezone, cancel_cutoff_hours, is_active, created_at, updated_at
       FROM tenants
       WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async insertTenant(params: {
    name: string;
    slug: string;
    logoUrl: string | null;
    timezone: string;
    cancelCutoffHours: number;
  }): Promise<TenantRow> {
    const { rows } = await this.query<TenantRow>(
      this.pool,
      `INSERT INTO tenants (
         name, slug, is_active, timezone, logo_url, cancel_cutoff_hours, created_at, updated_at
       )
       VALUES ($1, $2, true, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, slug, logo_url, timezone, cancel_cutoff_hours, is_active, created_at, updated_at`,
      [
        params.name,
        params.slug,
        params.timezone,
        params.logoUrl,
        params.cancelCutoffHours,
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Insert tenant returned no row');
    }
    return row;
  }

  /**
   * Super-admin tenant directory: newest first, optional is_active filter.
   * Uses LIMIT $1 OFFSET $2; filter is $3 (null = no filter).
   */
  async findTenantsForAdmin(params: {
    limit: number;
    offset: number;
    isActiveFilter: boolean | null;
  }): Promise<TenantAdminListRow[]> {
    const { rows } = await this.query<TenantAdminListRow>(
      this.pool,
      `SELECT id, name, slug, timezone, cancel_cutoff_hours, is_active, created_at, updated_at
       FROM tenants
       WHERE ($3::boolean IS NULL OR is_active = $3)
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [params.limit, params.offset, params.isActiveFilter],
    );
    return rows;
  }

  async countTenantsForAdmin(isActiveFilter: boolean | null): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::int AS count
       FROM tenants
       WHERE ($1::boolean IS NULL OR is_active = $1)`,
      [isActiveFilter],
    );
    const raw = rows[0]?.count;
    if (raw === undefined) {
      return 0;
    }
    return typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  }
}
