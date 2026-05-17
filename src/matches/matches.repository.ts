import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository, type DbExecutor } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';
import { DEFAULT_MATCH_SORT, MatchSortBy, SORT_BY_SQL } from './match-sort-by';
import type {
  MatchSide,
  PlayerStatEntryDto,
} from './dto/submit-match-results.dto';

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
  is_fake: boolean;
  min_real_spots: number;
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
  is_fake: boolean;
  min_real_spots: number;
  fake_bookings_count: number;
  created_at: Date;
  updated_at: Date;
  spots_remaining: number;
  roster: unknown;
  waitlist: unknown;
  waitlist_count: number;
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
  venue_picture_url: string | null;
  is_fake: boolean;
  spots_remaining: number;
  waitlist_count: number;
};

/** Row for GET /matches/:matchId/waitlist (operator). */
export type WaitlistEntryRow = {
  booking_id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  email: string;
  position: string;
  paid_amount: string;
  created_at: Date;
  queue_position: number;
};

/** Row returned by findMatchResult (includes aggregated player stats). */
export type MatchResultRow = {
  match_id: string;
  winning_side: string | null;
  submitted_by: string;
  created_at: Date;
  players: unknown;
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
  is_fake: boolean;
  min_real_spots: number;
  fake_bookings_count: number;
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
  /**
   * Builds the shared FROM + WHERE fragment for player browse queries.
   * Fixed params: $1 tenantId, $2 sportType, $3 venueId, $4 date, $5 available, $6 timezone.
   * dayOfWeek values are inlined as integer literals (validated 1–7; no injection risk).
   */
  private static buildBrowseFrom(dayOfWeek: number[] | null): string {
    const dowClause =
      dayOfWeek && dayOfWeek.length > 0
        ? `AND EXTRACT(ISODOW FROM m.scheduled_at AT TIME ZONE $6)::int
        IN (${dayOfWeek.join(', ')})`
        : '';

    return `
    FROM matches m
    INNER JOIN venues v ON v.id = m.venue_id
    LEFT JOIN (
      SELECT b.match_id,
        COUNT(*)::int AS confirmed_count,
        COUNT(*) FILTER (WHERE u.is_fake = true)::int AS fake_confirmed_count
      FROM bookings b
      INNER JOIN users u ON u.id = b.user_id
      WHERE b.status = 'confirmed'
      GROUP BY b.match_id
    ) bc ON bc.match_id = m.id
    LEFT JOIN (
      SELECT match_id, COUNT(*)::int AS waitlist_count
      FROM bookings
      WHERE status = 'pending'
      GROUP BY match_id
    ) wc ON wc.match_id = m.id
    WHERE v.tenant_id = $1
      AND m.status <> 'cancelled'
      AND now() < m.scheduled_at
      AND v.is_active = true
      AND ($2::text IS NULL OR m.sport_type = $2::sport_type)
      AND ($3::uuid IS NULL OR m.venue_id = $3)
      AND (
        $4::date IS NULL
        OR (m.scheduled_at AT TIME ZONE $6)::date = $4::date
      )
      AND (
        $5::boolean IS DISTINCT FROM true
        OR GREATEST(
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0),
          LEAST(
            COALESCE(m.min_real_spots, 0),
            COALESCE(bc.fake_confirmed_count, 0)
          )
        ) > 0
      )
      ${dowClause}`;
  }

  async countUpcomingMatchesForBrowse(params: {
    tenantId: string;
    sportType: string | null;
    venueId: string | null;
    date: string | null;
    available: boolean | null;
    timezone: string;
    dayOfWeek: number[] | null;
  }): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS count
      ${MatchesRepository.buildBrowseFrom(params.dayOfWeek)}`,
      [
        params.tenantId,
        params.sportType,
        params.venueId,
        params.date,
        params.available,
        params.timezone,
      ],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /**
   * Match in tenant with spots, confirmed roster, and waitlist (FIFO-ordered).
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
        m.is_fake,
        m.min_real_spots,
        COALESCE(bc.fake_confirmed_count, 0) AS fake_bookings_count,
        m.created_at,
        m.updated_at,
        GREATEST(
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0),
          LEAST(
            COALESCE(m.min_real_spots, 0),
            COALESCE(bc.fake_confirmed_count, 0)
          )
        ) AS spots_remaining,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'userId', u.id::text,
                'name', u.name,
                'photoUrl', u.photo_url,
                'position', b.position::text,
                'isFake', u.is_fake,
                'joinedAt', b.created_at
              )
              ORDER BY u.is_fake ASC, b.created_at ASC, u.name ASC
            )
            FROM bookings b
            INNER JOIN users u ON u.id = b.user_id
            WHERE b.match_id = m.id
              AND b.status = 'confirmed'
              AND u.deleted_at IS NULL
          ),
          '[]'::json
        ) AS roster,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'userId', wl.user_id,
                'name', wl.name,
                'photoUrl', wl.photo_url,
                'position', wl.position,
                'queuePosition', wl.rn,
                'joinedAt', wl.created_at
              )
              ORDER BY wl.rn
            )
            FROM (
              SELECT u.id::text AS user_id, u.name, u.photo_url,
                     b.position::text AS position, b.created_at,
                     ROW_NUMBER() OVER (ORDER BY b.created_at ASC) AS rn
              FROM bookings b
              INNER JOIN users u ON u.id = b.user_id
              WHERE b.match_id = m.id
                AND b.status = 'pending'
                AND u.deleted_at IS NULL
            ) wl
          ),
          '[]'::json
        ) AS waitlist,
        COALESCE(wc.waitlist_count, 0) AS waitlist_count
      FROM matches m
      INNER JOIN venues v ON v.id = m.venue_id
      LEFT JOIN (
        SELECT b.match_id,
          COUNT(*)::int AS confirmed_count,
          COUNT(*) FILTER (WHERE u.is_fake = true)::int AS fake_confirmed_count
        FROM bookings b
        INNER JOIN users u ON u.id = b.user_id
        WHERE b.status = 'confirmed'
        GROUP BY b.match_id
      ) bc ON bc.match_id = m.id
      LEFT JOIN (
        SELECT match_id, COUNT(*)::int AS waitlist_count
        FROM bookings
        WHERE status = 'pending'
        GROUP BY match_id
      ) wc ON wc.match_id = m.id
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
    timezone: string;
    sortBy: MatchSortBy | null;
    dayOfWeek: number[] | null;
    limit: number;
    offset: number;
  }): Promise<MatchBrowseRow[]> {
    const primarySort = SORT_BY_SQL[params.sortBy ?? DEFAULT_MATCH_SORT];
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
        v.picture_url AS venue_picture_url,
        m.is_fake,
        GREATEST(
          COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0),
          LEAST(
            COALESCE(m.min_real_spots, 0),
            COALESCE(bc.fake_confirmed_count, 0)
          )
        ) AS spots_remaining,
        COALESCE(wc.waitlist_count, 0) AS waitlist_count
      ${MatchesRepository.buildBrowseFrom(params.dayOfWeek)}
      ORDER BY ${primarySort}, m.id ASC
      LIMIT $7 OFFSET $8`,
      [
        params.tenantId,
        params.sportType,
        params.venueId,
        params.date,
        params.available,
        params.timezone,
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
        m.is_fake,
        m.min_real_spots,
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
      minRealSpots?: number;
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
    if (patch.minRealSpots !== undefined) {
      sets.push(`min_real_spots = $${idx++}`);
      values.push(patch.minRealSpots);
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
        m.is_fake,
        m.min_real_spots,
        m.created_at,
        m.updated_at`,
      values,
    );
    return rows[0] ?? null;
  }

  /**
   * Shared FROM clause for operator match queries (all statuses, no active-venue restriction).
   * Params: $1 tenantId, $2 status, $3 dateFrom, $4 dateTo, $5 venueId, $6 sportType, $7 search, $8 timezone
   */
  private static readonly operatorMatchesFrom = `
    FROM matches m
    INNER JOIN venues v ON v.id = m.venue_id
    LEFT JOIN (
      SELECT b.match_id,
        COUNT(*) FILTER (WHERE b.status = 'confirmed')::int AS confirmed_count,
        COUNT(*) FILTER (WHERE b.status = 'pending')::int   AS waitlist_count,
        COUNT(*) FILTER (
          WHERE b.status = 'confirmed' AND u.is_fake = true
        )::int AS fake_confirmed_count
      FROM bookings b
      INNER JOIN users u ON u.id = b.user_id
      GROUP BY b.match_id
    ) bc ON bc.match_id = m.id
    WHERE v.tenant_id = $1
      AND (
        $2::text IS NULL
        OR (${COMPUTED_STATUS_SQL}) = $2
      )
      AND ($3::date IS NULL OR (m.scheduled_at AT TIME ZONE $8)::date >= $3::date)
      AND ($4::date IS NULL OR (m.scheduled_at AT TIME ZONE $8)::date <= $4::date)
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
    timezone: string;
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
        params.timezone,
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
    timezone: string;
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
          COALESCE(m.max_players, 0)
          - COALESCE(bc.confirmed_count, 0)
        ) AS spots_remaining,
        m.is_fake,
        m.min_real_spots,
        COALESCE(bc.fake_confirmed_count, 0) AS fake_bookings_count,
        m.created_at,
        m.updated_at
      ${MatchesRepository.operatorMatchesFrom}
      ORDER BY m.scheduled_at DESC
      LIMIT $9 OFFSET $10`,
      [
        params.tenantId,
        params.status,
        params.dateFrom,
        params.dateTo,
        params.venueId,
        params.sportType,
        params.search,
        params.timezone,
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
    isFake?: boolean;
    minRealSpots?: number;
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
          max_players,
          is_fake,
          min_real_spots
        )
        VALUES ($1, $2, $3::sport_type, $4, $5, $6, 'scheduled', $7, $8, $9)
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
        m.is_fake,
        m.min_real_spots,
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
        input.isFake ?? false,
        input.minRealSpots ?? 0,
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('insertMatch: expected one row');
    }
    return row;
  }

  /**
   * Inserts match_results + player_match_stats rows atomically.
   * Throws PG unique violation (23505) on the match_results UNIQUE(match_id) if already submitted.
   */
  async insertMatchResults(
    executor: DbExecutor,
    params: {
      matchId: string;
      winningSide: MatchSide | null;
      submittedBy: string;
      players: PlayerStatEntryDto[];
    },
  ): Promise<void> {
    await this.query(
      executor,
      `INSERT INTO match_results (match_id, winning_side, submitted_by)
       VALUES ($1, $2::match_side, $3)`,
      [params.matchId, params.winningSide ?? null, params.submittedBy],
    );

    for (const p of params.players) {
      await this.query(
        executor,
        `INSERT INTO player_match_stats (match_id, user_id, team_side, goals, assists, is_mvp)
         VALUES ($1, $2, $3::match_side, $4, $5, $6)`,
        [
          params.matchId,
          p.userId,
          p.teamSide,
          p.goals ?? 0,
          p.assists ?? 0,
          p.isMvp ?? false,
        ],
      );
    }
  }

  /** Fetch submitted result + per-player stats for a match. Returns null if not yet submitted. */
  async findMatchResult(matchId: string): Promise<MatchResultRow | null> {
    const { rows } = await this.query<MatchResultRow>(
      this.pool,
      `SELECT
         mr.match_id,
         mr.winning_side::text  AS winning_side,
         mr.submitted_by,
         mr.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'userId',   pms.user_id::text,
               'teamSide', pms.team_side::text,
               'goals',    pms.goals,
               'assists',  pms.assists,
               'isMvp',    pms.is_mvp
             )
             ORDER BY pms.user_id
           ) FILTER (WHERE pms.user_id IS NOT NULL),
           '[]'::json
         ) AS players
       FROM match_results mr
       LEFT JOIN player_match_stats pms ON pms.match_id = mr.match_id
       WHERE mr.match_id = $1
       GROUP BY mr.match_id, mr.winning_side, mr.submitted_by, mr.created_at`,
      [matchId],
    );
    return rows[0] ?? null;
  }

  /** Returns user IDs of confirmed bookings for a match (used for validation). */
  async findConfirmedPlayerIdsForMatch(matchId: string): Promise<string[]> {
    const { rows } = await this.query<{ user_id: string }>(
      this.pool,
      `SELECT user_id::text FROM bookings WHERE match_id = $1 AND status = 'confirmed'`,
      [matchId],
    );
    return rows.map((r) => r.user_id);
  }

  /**
   * Auto-fills a fake match with confirmed bookings for randomly-picked fake users.
   *
   * - Ignores `count` when null and fills up to (max_players - min_real_spots).
   * - Caps the actual insert to whatever real capacity / fake-quota is left.
   * - Inserts bookings as `confirmed` with `paid_amount = 0` (no wallet, no email).
   * - Runs in a single transaction with `FOR UPDATE` on the match row to avoid
   *   races with concurrent real-player bookings.
   */
  async autoFillFakeMatch(params: {
    tenantId: string;
    matchId: string;
    count: number | null;
  }): Promise<
    | {
        success: true;
        filled: number;
        confirmedCount: number;
        fakeBookingsCount: number;
        spotsRemaining: number;
      }
    | {
        success: false;
        code:
          | 'MATCH_NOT_FOUND'
          | 'MATCH_NOT_FAKE'
          | 'MATCH_NOT_UPCOMING'
          | 'MATCH_FULL_FOR_FAKES';
      }
  > {
    return this.withTransaction(async (client) => {
      const { rows: matchRows } = await this.query<{
        id: string;
        status: string;
        scheduled_at: Date;
        max_players: number | null;
        is_fake: boolean;
        min_real_spots: number;
        is_active: boolean;
        is_future: boolean;
      }>(
        client,
        `SELECT
          m.id,
          m.status,
          m.scheduled_at,
          m.max_players,
          m.is_fake,
          m.min_real_spots,
          v.is_active,
          (m.scheduled_at > now()) AS is_future
        FROM matches m
        INNER JOIN venues v ON v.id = m.venue_id
        WHERE m.id = $1 AND v.tenant_id = $2
        FOR UPDATE OF m`,
        [params.matchId, params.tenantId],
      );

      const match = matchRows[0];
      if (!match) {
        return { success: false as const, code: 'MATCH_NOT_FOUND' as const };
      }
      if (!match.is_fake) {
        return { success: false as const, code: 'MATCH_NOT_FAKE' as const };
      }
      if (match.status === 'cancelled' || !match.is_future) {
        return { success: false as const, code: 'MATCH_NOT_UPCOMING' as const };
      }

      const { rows: countRows } = await this.query<{
        confirmed_count: string;
        fake_count: string;
      }>(
        client,
        `SELECT
          COUNT(*)::text AS confirmed_count,
          COUNT(*) FILTER (WHERE u.is_fake = true)::text AS fake_count
        FROM bookings b
        INNER JOIN users u ON u.id = b.user_id
        WHERE b.match_id = $1 AND b.status = 'confirmed'`,
        [params.matchId],
      );
      const confirmedCount = parseInt(countRows[0]?.confirmed_count ?? '0', 10);
      const fakeCount = parseInt(countRows[0]?.fake_count ?? '0', 10);
      const maxPlayers = match.max_players ?? 0;

      const fakeQuotaRemaining = Math.max(
        0,
        maxPlayers - match.min_real_spots - fakeCount,
      );
      const capacityRemaining = Math.max(0, maxPlayers - confirmedCount);
      const cap = Math.min(fakeQuotaRemaining, capacityRemaining);

      if (cap <= 0) {
        return {
          success: false as const,
          code: 'MATCH_FULL_FOR_FAKES' as const,
        };
      }

      const requested = params.count ?? cap;
      const take = Math.min(Math.max(0, requested), cap);
      if (take <= 0) {
        return {
          success: true as const,
          filled: 0,
          confirmedCount,
          fakeBookingsCount: fakeCount,
          spotsRemaining: capacityRemaining,
        };
      }

      const { rows: pickedRows } = await this.query<{ id: string }>(
        client,
        `SELECT u.id
         FROM users u
         WHERE u.tenant_id = $1
           AND u.is_fake = true
           AND u.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.match_id = $2
               AND b.user_id = u.id
               AND b.status IN ('pending', 'confirmed')
           )
         ORDER BY random()
         LIMIT $3`,
        [params.tenantId, params.matchId, take],
      );

      const userIds = pickedRows.map((r) => r.id);
      if (userIds.length === 0) {
        return {
          success: true as const,
          filled: 0,
          confirmedCount,
          fakeBookingsCount: fakeCount,
          spotsRemaining: capacityRemaining,
        };
      }

      const { rows: inserted } = await this.query<{ id: string }>(
        client,
        `INSERT INTO bookings (match_id, user_id, status, paid_amount, position)
         SELECT $1, uid, 'confirmed'::booking_status, 0, 'field_player'::booking_position
         FROM UNNEST($2::uuid[]) AS t(uid)
         RETURNING id`,
        [params.matchId, userIds],
      );

      const filled = inserted.length;
      return {
        success: true as const,
        filled,
        confirmedCount: confirmedCount + filled,
        fakeBookingsCount: fakeCount + filled,
        spotsRemaining: capacityRemaining - filled,
      };
    });
  }

  /**
   * Hard-deletes all confirmed fake bookings on a fake match.
   *
   * - Admin-triggered cleanup once a match has organic real demand and the
   *   fake roster is no longer needed.
   * - Runs in a single transaction with `FOR UPDATE` on the match row so
   *   concurrent real bookings / auto-fills serialize behind it.
   * - Does not touch waitlist (pending) bookings. Waitlist promotion for the
   *   freed seats is triggered by the service layer after commit.
   */
  async clearFakeBookingsForMatch(params: {
    tenantId: string;
    matchId: string;
  }): Promise<
    | {
        success: true;
        removed: number;
        confirmedCount: number;
        fakeBookingsCount: number;
        spotsRemaining: number;
      }
    | {
        success: false;
        code: 'MATCH_NOT_FOUND' | 'MATCH_NOT_FAKE' | 'MATCH_NOT_UPCOMING';
      }
  > {
    return this.withTransaction(async (client) => {
      const { rows: matchRows } = await this.query<{
        id: string;
        status: string;
        max_players: number | null;
        is_fake: boolean;
        is_future: boolean;
      }>(
        client,
        `SELECT
          m.id,
          m.status,
          m.max_players,
          m.is_fake,
          (m.scheduled_at > now()) AS is_future
        FROM matches m
        INNER JOIN venues v ON v.id = m.venue_id
        WHERE m.id = $1 AND v.tenant_id = $2
        FOR UPDATE OF m`,
        [params.matchId, params.tenantId],
      );

      const match = matchRows[0];
      if (!match) {
        return { success: false as const, code: 'MATCH_NOT_FOUND' as const };
      }
      if (!match.is_fake) {
        return { success: false as const, code: 'MATCH_NOT_FAKE' as const };
      }
      if (match.status === 'cancelled' || !match.is_future) {
        return { success: false as const, code: 'MATCH_NOT_UPCOMING' as const };
      }

      const { rows: deleted } = await this.query<{ id: string }>(
        client,
        `DELETE FROM bookings
         WHERE id IN (
           SELECT b.id
           FROM bookings b
           INNER JOIN users u ON u.id = b.user_id
           WHERE b.match_id = $1
             AND b.status = 'confirmed'
             AND u.is_fake = true
         )
         RETURNING id`,
        [params.matchId],
      );

      const removed = deleted.length;

      const { rows: countRows } = await this.query<{ confirmed_count: string }>(
        client,
        `SELECT COUNT(*)::text AS confirmed_count
         FROM bookings
         WHERE match_id = $1 AND status = 'confirmed'`,
        [params.matchId],
      );
      const confirmedCount = parseInt(countRows[0]?.confirmed_count ?? '0', 10);
      const maxPlayers = match.max_players ?? 0;
      const spotsRemaining = Math.max(0, maxPlayers - confirmedCount);

      return {
        success: true as const,
        removed,
        confirmedCount,
        fakeBookingsCount: 0,
        spotsRemaining,
      };
    });
  }

  async findWaitlistForMatch(
    matchId: string,
    tenantId: string,
  ): Promise<WaitlistEntryRow[]> {
    const { rows } = await this.query<WaitlistEntryRow>(
      this.pool,
      `SELECT
        b.id AS booking_id,
        u.id::text AS user_id,
        u.name,
        u.photo_url,
        u.email,
        b.position::text AS position,
        b.paid_amount::text AS paid_amount,
        b.created_at,
        ROW_NUMBER() OVER (ORDER BY b.created_at ASC) AS queue_position
      FROM bookings b
      INNER JOIN users u ON u.id = b.user_id
      INNER JOIN matches m ON m.id = b.match_id
      INNER JOIN venues v ON v.id = m.venue_id
      WHERE b.match_id = $1
        AND v.tenant_id = $2
        AND b.status = 'pending'
        AND u.deleted_at IS NULL
      ORDER BY b.created_at ASC`,
      [matchId, tenantId],
    );
    return rows;
  }
}
