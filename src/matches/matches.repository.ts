import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type MatchRow = {
  id: string;
  venue_id: string;
  title: string;
  sport_type: string;
  scheduled_at: Date;
  duration_mins: number;
  price_per_player: string;
  status: string;
  max_players: number | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class MatchesRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  /**
   * True if another non-cancelled match at this venue overlaps [scheduledAt, scheduledAt + durationMins).
   * Touching endpoints (one ends exactly when the other starts) does not count as overlap.
   */
  async hasOverlappingMatchAtVenue(
    venueId: string,
    scheduledAt: Date,
    durationMins: number,
  ): Promise<boolean> {
    const { rows } = await this.query<{ exists: boolean }>(
      this.pool,
      `SELECT EXISTS (
        SELECT 1
        FROM matches m
        WHERE m.venue_id = $1
          AND m.status <> 'cancelled'
          AND m.scheduled_at < ($2::timestamptz + ($3::int * interval '1 minute'))
          AND (m.scheduled_at + (m.duration_mins * interval '1 minute')) > $2::timestamptz
      ) AS exists`,
      [venueId, scheduledAt, durationMins],
    );
    return rows[0]?.exists ?? false;
  }

  async insertMatch(input: {
    venueId: string;
    title: string;
    sportType: string;
    scheduledAt: Date;
    durationMins: number;
    maxPlayers: number;
    pricePerPlayer: number;
  }): Promise<MatchRow> {
    const { rows } = await this.query<MatchRow>(
      this.pool,
      `INSERT INTO matches (
        venue_id,
        title,
        sport_type,
        scheduled_at,
        duration_mins,
        price_per_player,
        status,
        max_players
      )
      VALUES ($1, $2, $3::sport_type, $4, $5, $6, 'upcoming', $7)
      RETURNING
        id,
        venue_id,
        title,
        sport_type,
        scheduled_at,
        duration_mins,
        price_per_player,
        status,
        max_players,
        created_at,
        updated_at`,
      [
        input.venueId,
        input.title,
        input.sportType,
        input.scheduledAt,
        input.durationMins,
        input.pricePerPlayer,
        input.maxPlayers,
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('insertMatch: expected one row');
    }
    return row;
  }
}
