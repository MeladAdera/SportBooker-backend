import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';
import type { VenueSportType } from './venue-sport-type';

export type VenueRow = {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  maps_url: string | null;
  picture_url: string | null;
  sport_types: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

/** Row for GET /venues browse (active venues only, limited columns). */
export type VenueBrowseRow = {
  id: string;
  name: string;
  address: string;
  maps_url: string;
  sport_types: string[];
  is_active: boolean;
};

/** Row for GET /venues/:id (active venue in tenant, includes picture). */
export type VenueDetailRow = {
  id: string;
  name: string;
  address: string;
  maps_url: string;
  sport_types: string[];
  is_active: boolean;
  picture_url: string | null;
};

@Injectable()
export class VenuesRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  async insertVenue(
    tenantId: string,
    input: {
      name: string;
      address: string;
      mapsUrl: string;
      pictureUrl: string | null;
      sportTypes: VenueSportType[];
    },
  ): Promise<VenueRow> {
    const { rows } = await this.query<VenueRow>(
      this.pool,
      `INSERT INTO venues (
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6::text[], true)
      RETURNING
        id,
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active,
        created_at,
        updated_at`,
      [
        tenantId,
        input.name,
        input.address,
        input.mapsUrl,
        input.pictureUrl,
        input.sportTypes,
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('insertVenue: expected one row');
    }
    return row;
  }

  /**
   * Count active venues for the tenant; optional sportType filters with sport_types @> ARRAY[$sport].
   */
  async countActiveVenuesForBrowse(
    tenantId: string,
    sportType: VenueSportType | undefined,
  ): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      FROM venues
      WHERE tenant_id = $1
        AND is_active = true
        AND ($2::text IS NULL OR sport_types @> ARRAY[$2]::text[])`,
      [tenantId, sportType ?? null],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /**
   * Active venues for the tenant; optional sportType filters with sport_types @> ARRAY[$sport].
   */
  async findActiveVenuesForBrowse(
    tenantId: string,
    sportType: VenueSportType | undefined,
    limit: number,
    offset: number,
  ): Promise<VenueBrowseRow[]> {
    const { rows } = await this.query<VenueBrowseRow>(
      this.pool,
      `SELECT
        id,
        name,
        address,
        maps_url,
        sport_types,
        is_active
      FROM venues
      WHERE tenant_id = $1
        AND is_active = true
        AND ($2::text IS NULL OR sport_types @> ARRAY[$2]::text[])
      ORDER BY name ASC
      LIMIT $3 OFFSET $4`,
      [tenantId, sportType ?? null, limit, offset],
    );
    return rows;
  }

  /**
   * One active venue by id scoped to tenant (no cross-tenant access).
   */
  async findActiveVenueByIdForTenant(
    venueId: string,
    tenantId: string,
  ): Promise<VenueDetailRow | null> {
    const { rows } = await this.query<VenueDetailRow>(
      this.pool,
      `SELECT
        id,
        name,
        address,
        maps_url,
        sport_types,
        is_active,
        picture_url
      FROM venues
      WHERE id = $1
        AND tenant_id = $2
        AND is_active = true`,
      [venueId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Any venue row in the tenant (active or not), for admin flows. */
  async findVenueRowByIdForTenant(
    venueId: string,
    tenantId: string,
  ): Promise<VenueRow | null> {
    const { rows } = await this.query<VenueRow>(
      this.pool,
      `SELECT
        id,
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active,
        created_at,
        updated_at
      FROM venues
      WHERE id = $1 AND tenant_id = $2`,
      [venueId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Matches that block venue deactivation: in progress, or scheduled and not yet started (upcoming).
   */
  async countBlockingMatchesForVenue(venueId: string): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      FROM matches
      WHERE venue_id = $1
        AND (
          status = 'in_progress'
          OR (
            status IN ('scheduled', 'upcoming')
            AND scheduled_at >= now()
          )
        )`,
      [venueId],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /** Sets is_active = true; returns null if venue missing, wrong tenant, or already active. */
  async activateVenueForTenant(
    tenantId: string,
    venueId: string,
  ): Promise<VenueRow | null> {
    const { rows } = await this.query<VenueRow>(
      this.pool,
      `UPDATE venues
      SET is_active = true, updated_at = now()
      WHERE id = $1
        AND tenant_id = $2
        AND is_active = false
      RETURNING
        id,
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active,
        created_at,
        updated_at`,
      [venueId, tenantId],
    );
    return rows[0] ?? null;
  }

  /** Sets is_active = false; returns null if venue missing or wrong tenant. */
  async deactivateVenueForTenant(
    tenantId: string,
    venueId: string,
  ): Promise<VenueRow | null> {
    const { rows } = await this.query<VenueRow>(
      this.pool,
      `UPDATE venues
      SET is_active = false, updated_at = now()
      WHERE id = $1
        AND tenant_id = $2
        AND is_active = true
      RETURNING
        id,
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active,
        created_at,
        updated_at`,
      [venueId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Partial update; only provided keys are set. Returns null if no row matched (wrong tenant or id).
   */
  async patchVenueForTenant(
    tenantId: string,
    venueId: string,
    patch: {
      name?: string;
      address?: string;
      mapsUrl?: string;
      pictureUrl?: string | null;
      sportTypes?: VenueSportType[];
    },
  ): Promise<VenueRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [venueId, tenantId];
    let idx = 3;

    if (patch.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(patch.name);
    }
    if (patch.address !== undefined) {
      sets.push(`address = $${idx++}`);
      values.push(patch.address);
    }
    if (patch.mapsUrl !== undefined) {
      sets.push(`maps_url = $${idx++}`);
      values.push(patch.mapsUrl);
    }
    if (patch.pictureUrl !== undefined) {
      sets.push(`picture_url = $${idx++}`);
      values.push(patch.pictureUrl);
    }
    if (patch.sportTypes !== undefined) {
      sets.push(`sport_types = $${idx++}::text[]`);
      values.push(patch.sportTypes);
    }

    sets.push(`updated_at = now()`);

    const { rows } = await this.query<VenueRow>(
      this.pool,
      `UPDATE venues
      SET ${sets.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING
        id,
        tenant_id,
        name,
        address,
        maps_url,
        picture_url,
        sport_types,
        is_active,
        created_at,
        updated_at`,
      values,
    );
    return rows[0] ?? null;
  }
}
