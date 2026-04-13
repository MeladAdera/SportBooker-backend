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

/** Row for GET /matches/:id (tenant-scoped). */
export type MatchDetailRow = {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_address: string;
  venue_picture_url: string;
  title: string;
  sport_type: string;
  scheduled_at: Date;
  duration_mins: number;
  price_per_player: string;
  status: string;
  max_players: number | null;
  created_at: Date;
  updated_at: Date;
  spots_remaining: number;
  roster: unknown;
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

/** Row for operator match management list (all statuses). */
export type MatchOperatorRow = {
  id: string;
  title: string;
  sport_type: string;
  scheduled_at: Date;
  duration_mins: number;
  price_per_player: string;
  max_players: number | null;
  status: string;
  venue_id: string;
  venue_name: string;
  confirmed_count: number;
  waitlist_count: number;
  spots_remaining: number;
  created_at: Date;
  updated_at: Date;
};

/**
 * Computes the effective match status from stored data + current time.
 * Only 'scheduled' and 'cancelled' are stored; the rest are derived.
 */
const COMPUTED_STATUS_SQL = `
  CASE
    WHEN m.status = 'cancelled' THEN 'cancelled'
    WHEN now() < m.scheduled_at THEN 'upcoming'
    WHEN now() < m.scheduled_at + (m.duration_mins * interval '1 minute') THEN 'in_progress'
    ELSE 'completed'
  END`;

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
      AND m.status <> 'cancelled'
      AND now() < m.scheduled_at
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

  /**
   * Match in tenant with spots + confirmed roster (pending bookings excluded).
   * Returns null if match id wrong or venue not in tenant.
   */
  async findMatchDetailForTenant(
    matchId: string,
    tenantId: string,
  ): Promise<MatchDetailRow | null> {
    const { rows } = await this.query<MatchDetailRow>(
      this.pool,
      `SELECT
        m.id,
        m.venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.picture_url AS venue_picture_url,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        ${COMPUTED_STATUS_SQL} AS status,
        m.max_players,
        m.created_at,
        m.updated_at,
        GREATEST(
          0,
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)
        ) AS spots_remaining,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'userId', u.id::text,
                'name', u.name,
                'photoUrl', u.photo_url,
                'position', b.position::text
              )
              ORDER BY u.name
            )
            FROM bookings b
            INNER JOIN users u ON u.id = b.user_id
            WHERE b.match_id = m.id
              AND b.status = 'confirmed'
              AND u.deleted_at IS NULL
          ),
          '[]'::json
        ) AS roster
      FROM matches m
      INNER JOIN venues v ON v.id = m.venue_id
      LEFT JOIN (
        SELECT match_id, COUNT(*)::int AS confirmed_count
        FROM bookings
        WHERE status = 'confirmed'
        GROUP BY match_id
      ) bc ON bc.match_id = m.id
      WHERE m.id = $1 AND v.tenant_id = $2`,
      [matchId, tenantId],
    );
    return rows[0] ?? null;
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
        ${COMPUTED_STATUS_SQL} AS status,
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

  /**
   * @param excludeMatchId When set, that match is ignored (for updates).
   */
  async hasOverlappingMatchAtVenue(
    venueId: string,
    scheduledAt: Date,
    durationMins: number,
    excludeMatchId: string | null = null,
  ): Promise<boolean> {
    const { rows } = await this.query<{ exists: boolean }>(
      this.pool,
      `SELECT EXISTS (
        SELECT 1
        FROM matches m
        WHERE m.venue_id = $1
          AND m.status <> 'cancelled'
          AND ($4::uuid IS NULL OR m.id <> $4)
          AND m.scheduled_at < ($2::timestamptz + ($3::int * interval '1 minute'))
          AND (m.scheduled_at + (m.duration_mins * interval '1 minute')) > $2::timestamptz
      ) AS exists`,
      [venueId, scheduledAt, durationMins, excludeMatchId],
    );
    return rows[0]?.exists ?? false;
  }

  async findMatchRowForTenant(
    matchId: string,
    tenantId: string,
  ): Promise<MatchRow | null> {
    const { rows } = await this.query<MatchRow>(
      this.pool,
      `SELECT
        m.id,
        m.venue_id,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        ${COMPUTED_STATUS_SQL} AS status,
        m.max_players,
        m.created_at,
        m.updated_at
      FROM matches m
      INNER JOIN venues v ON v.id = m.venue_id
      WHERE m.id = $1 AND v.tenant_id = $2`,
      [matchId, tenantId],
    );
    return rows[0] ?? null;
  }

  async countConfirmedBookingsForMatch(matchId: string): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      FROM bookings
      WHERE match_id = $1 AND status = 'confirmed'`,
      [matchId],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async patchMatchForTenant(
    tenantId: string,
    matchId: string,
    patch: {
      title?: string;
      sportType?: string;
      venueId?: string;
      scheduledAt?: Date;
      durationMins?: number;
      maxPlayers?: number;
      pricePerPlayer?: number;
    },
  ): Promise<MatchRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [matchId, tenantId];
    let idx = 3;

    if (patch.title !== undefined) {
      sets.push(`title = $${idx++}`);
      values.push(patch.title);
    }
    if (patch.sportType !== undefined) {
      sets.push(`sport_type = $${idx++}::sport_type`);
      values.push(patch.sportType);
    }
    if (patch.venueId !== undefined) {
      sets.push(`venue_id = $${idx++}`);
      values.push(patch.venueId);
    }
    if (patch.scheduledAt !== undefined) {
      sets.push(`scheduled_at = $${idx++}`);
      values.push(patch.scheduledAt);
    }
    if (patch.durationMins !== undefined) {
      sets.push(`duration_mins = $${idx++}`);
      values.push(patch.durationMins);
    }
    if (patch.maxPlayers !== undefined) {
      sets.push(`max_players = $${idx++}`);
      values.push(patch.maxPlayers);
    }
    if (patch.pricePerPlayer !== undefined) {
      sets.push(`price_per_player = $${idx++}`);
      values.push(patch.pricePerPlayer);
    }

    if (sets.length === 0) {
      return this.findMatchRowForTenant(matchId, tenantId);
    }

    sets.push(`updated_at = now()`);

    const { rows } = await this.query<MatchRow>(
      this.pool,
      `UPDATE matches m
      SET ${sets.join(', ')}
      FROM venues v
      WHERE m.id = $1 AND m.venue_id = v.id AND v.tenant_id = $2
      RETURNING
        m.id,
        m.venue_id,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        ${COMPUTED_STATUS_SQL} AS status,
        m.max_players,
        m.created_at,
        m.updated_at`,
      values,
    );
    return rows[0] ?? null;
  }

  /**
   * Shared FROM clause for operator match queries (all statuses, no active-venue restriction).
   * Params: $1 tenantId, $2 status, $3 dateFrom, $4 dateTo, $5 venueId, $6 sportType, $7 search
   */
  private static readonly operatorMatchesFrom = `
    FROM matches m
    INNER JOIN venues v ON v.id = m.venue_id
    LEFT JOIN (
      SELECT match_id,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int   AS waitlist_count
      FROM bookings
      GROUP BY match_id
    ) bc ON bc.match_id = m.id
    WHERE v.tenant_id = $1
      AND (
        $2::text IS NULL
        OR (${COMPUTED_STATUS_SQL}) = $2
      )
      AND ($3::date IS NULL OR (m.scheduled_at AT TIME ZONE 'UTC')::date >= $3::date)
      AND ($4::date IS NULL OR (m.scheduled_at AT TIME ZONE 'UTC')::date <= $4::date)
      AND ($5::uuid IS NULL OR m.venue_id = $5)
      AND ($6::text IS NULL OR m.sport_type = $6::sport_type)
      AND ($7::text IS NULL OR m.title ILIKE '%' || $7 || '%')`;

  async countMatchesForOperator(params: {
    tenantId: string;
    status: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    venueId: string | null;
    sportType: string | null;
    search: string | null;
  }): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      ${MatchesRepository.operatorMatchesFrom}`,
      [
        params.tenantId,
        params.status,
        params.dateFrom,
        params.dateTo,
        params.venueId,
        params.sportType,
        params.search,
      ],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async findMatchesForOperator(params: {
    tenantId: string;
    status: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    venueId: string | null;
    sportType: string | null;
    search: string | null;
    limit: number;
    offset: number;
  }): Promise<MatchOperatorRow[]> {
    const { rows } = await this.query<MatchOperatorRow>(
      this.pool,
      `SELECT
        m.id,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        m.max_players,
        ${COMPUTED_STATUS_SQL} AS status,
        m.venue_id,
        v.name AS venue_name,
        COALESCE(bc.confirmed_count, 0) AS confirmed_count,
        COALESCE(bc.waitlist_count, 0)  AS waitlist_count,
        GREATEST(
          0,
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)
        ) AS spots_remaining,
        m.created_at,
        m.updated_at
      ${MatchesRepository.operatorMatchesFrom}
      ORDER BY m.scheduled_at DESC
      LIMIT $8 OFFSET $9`,
      [
        params.tenantId,
        params.status,
        params.dateFrom,
        params.dateTo,
        params.venueId,
        params.sportType,
        params.search,
        params.limit,
        params.offset,
      ],
    );
    return rows;
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
      `WITH m AS (
        INSERT INTO matches (
          venue_id,
          title,
          sport_type,
          scheduled_at,
          duration_mins,
          price_per_player,
          status,
          max_players
        )
        VALUES ($1, $2, $3::sport_type, $4, $5, $6, 'scheduled', $7)
        RETURNING *
      )
      SELECT
        m.id,
        m.venue_id,
        m.title,
        m.sport_type,
        m.scheduled_at,
        m.duration_mins,
        m.price_per_player,
        ${COMPUTED_STATUS_SQL} AS status,
        m.max_players,
        m.created_at,
        m.updated_at
      FROM m`,
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
