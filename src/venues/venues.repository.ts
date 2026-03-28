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
   * Active venues for the tenant; optional sportType filters with sport_types @> ARRAY[$sport].
   */
  async findActiveVenuesForBrowse(
    tenantId: string,
    sportType: VenueSportType | undefined,
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
      ORDER BY name ASC`,
      [tenantId, sportType ?? null],
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
}
