import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository, type DbExecutor } from '../database/base.repository';
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
export type TenantAdminListRow = Omit<TenantRow, 'logo_url'>;

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

  /**
   * Partial update; only keys present in `patch` are applied. `logoUrl: null` clears logo.
   * Refreshes `updated_at` when any column changes. No-op when patch is empty (returns current row).
   */
  async updateTenantById(
    id: string,
    patch: {
      name?: string;
      logoUrl?: string | null;
      timezone?: string;
      cancelCutoffHours?: number;
    },
  ): Promise<TenantRow | null> {
    const columns: { col: string; val: unknown }[] = [];
    if (patch.name !== undefined) {
      columns.push({ col: 'name', val: patch.name });
    }
    if (patch.logoUrl !== undefined) {
      columns.push({ col: 'logo_url', val: patch.logoUrl });
    }
    if (patch.timezone !== undefined) {
      columns.push({ col: 'timezone', val: patch.timezone });
    }
    if (patch.cancelCutoffHours !== undefined) {
      columns.push({
        col: 'cancel_cutoff_hours',
        val: patch.cancelCutoffHours,
      });
    }

    if (columns.length === 0) {
      return this.findTenantById(id);
    }

    const setFragments = columns.map((c, idx) => `${c.col} = $${idx + 1}`);
    const values = columns.map((c) => c.val);
    const idParam = values.length + 1;
    const { rows } = await this.query<TenantRow>(
      this.pool,
      `UPDATE tenants
       SET ${setFragments.join(', ')}, updated_at = NOW()
       WHERE id = $${idParam}
       RETURNING id, name, slug, logo_url, timezone, cancel_cutoff_hours, is_active, created_at, updated_at`,
      [...values, id],
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
    return this.insertTenantWithinTransaction(this.pool, params);
  }

  async insertTenantWithinTransaction(
    executor: DbExecutor,
    params: {
      name: string;
      slug: string;
      logoUrl: string | null;
      timezone: string;
      cancelCutoffHours: number;
    },
  ): Promise<TenantRow> {
    const { rows } = await this.query<TenantRow>(
      executor,
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

  /**
   * Sets is_active = false. Returns null if no row matched (e.g. wrong id).
   * Caller should only invoke when tenant is known active to avoid no-op semantics.
   */
  async deactivateTenantById(id: string): Promise<TenantRow | null> {
    const { rows } = await this.query<TenantRow>(
      this.pool,
      `UPDATE tenants
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING id, name, slug, logo_url, timezone, cancel_cutoff_hours, is_active, created_at, updated_at`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Sets is_active = true. Returns null if no row matched (e.g. wrong id or already active).
   */
  async activateTenantById(id: string): Promise<TenantRow | null> {
    const { rows } = await this.query<TenantRow>(
      this.pool,
      `UPDATE tenants
       SET is_active = true, updated_at = NOW()
       WHERE id = $1 AND is_active = false
       RETURNING id, name, slug, logo_url, timezone, cancel_cutoff_hours, is_active, created_at, updated_at`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Stores the Ziina access token and a freshly generated webhook HMAC secret.
   * Both are write-only — never included in tenant SELECT queries.
   */
  async updateZiinaCredentials(
    id: string,
    accessToken: string,
    webhookSecret: string,
  ): Promise<void> {
    await this.query(
      this.pool,
      `UPDATE tenants
       SET ziina_access_token = $1, ziina_webhook_secret = $2, updated_at = NOW()
       WHERE id = $3`,
      [accessToken, webhookSecret, id],
    );
  }
}
