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

@Injectable()
export class TenantsRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
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
}
