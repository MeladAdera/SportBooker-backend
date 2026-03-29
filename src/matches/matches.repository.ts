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

/** Row for player browse list (upcoming matches). */
export type MatchBrowseRow = {
  id: string;
  title: string;
  sport_type: string;
  scheduled_at: Date;
  duration_mins: number;
  price_per_player: string;
  max_players: number | null;
  status: string;
  venue_name: string;
  spots_remaining: number;
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
  private static readonly upcomingBrowseFrom = `
    FROM matches m
    INNER JOIN venues v ON v.id = m.venue_id
    LEFT JOIN (
      SELECT match_id, COUNT(*)::int AS confirmed_count
      FROM bookings
      WHERE status = 'confirmed'
      GROUP BY match_id
    ) bc ON bc.match_id = m.id
    WHERE v.tenant_id = $1
      AND m.status = 'upcoming'
      AND v.is_active = true
      AND ($2::text IS NULL OR m.sport_type = $2::sport_type)
      AND ($3::uuid IS NULL OR m.venue_id = $3)
      AND (
        $4::date IS NULL
        OR (m.scheduled_at AT TIME ZONE 'UTC')::date = $4::date
      )
      AND (
        $5::boolean IS DISTINCT FROM true
        OR (COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)) > 0
      )`;

  async countUpcomingMatchesForBrowse(params: {
    tenantId: string;
    sportType: string | null;
    venueId: string | null;
    date: string | null;
    available: boolean | null;
  }): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      ${MatchesRepository.upcomingBrowseFrom}`,
      [
        params.tenantId,
        params.sportType,
        params.venueId,
        params.date,
        params.available,
      ],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async findUpcomingMatchesForBrowse(params: {
    tenantId: string;
    sportType: string | null;
    venueId: string | null;
    date: string | null;
    available: boolean | null;
    limit: number;
    offset: number;
  }): Promise<MatchBrowseRow[]> {
    const { rows } = await this.query<MatchBrowseRow>(
      this.pool,
      `SELECT
        m.id,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        m.max_players,
        m.status,
        v.name AS venue_name,
        GREATEST(
          0,
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)
        ) AS spots_remaining
      ${MatchesRepository.upcomingBrowseFrom}
      ORDER BY m.scheduled_at ASC
      LIMIT $6 OFFSET $7`,
      [
        params.tenantId,
        params.sportType,
        params.venueId,
        params.date,
        params.available,
        params.limit,
        params.offset,
      ],
    );
    return rows;
  }

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
