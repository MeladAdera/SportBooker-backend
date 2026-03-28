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
}
