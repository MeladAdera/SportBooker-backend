import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type BookingRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  paid_amount: string;
  created_at: Date;
  updated_at: Date;
};

/** Row for GET /users/me/bookings (joined query). */
export type MyBookingHistoryRow = {
  id: string;
  status: string;
  paid_amount: string;
  match_title: string;
  sport_type: string;
  scheduled_at: Date;
  venue_name: string;
  created_at: Date;
};

/** Row for GET /bookings/:id (join match + venue; tenant via venue). */
export type BookingDetailRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  paid_amount: string;
  cancelled_at: Date | null;
  refunded_at: Date | null;
  created_at: Date;
  match_venue_id: string;
  match_title: string;
  sport_type: string;
  scheduled_at: Date;
  duration_mins: number;
  price_per_player: string;
  match_status: string;
  max_players: number | null;
  match_created_at: Date;
  match_updated_at: Date;
  venue_id: string;
  venue_name: string;
  address: string;
  maps_url: string;
  picture_url: string | null;
  sport_types: string[];
  venue_is_active: boolean;
  venue_created_at: Date;
  venue_updated_at: Date;
};

export type CreateBookingFailureCode =
  | 'MATCH_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'MATCH_CANCELLED'
  | 'MATCH_PAST'
  | 'VENUE_INACTIVE'
  | 'ALREADY_BOOKED'
  | 'INSUFFICIENT_FUNDS';

export type CreateBookingResult =
  | {
      success: true;
      booking: BookingRow;
      remainingSpots: number | null;
      /** When status is confirmed — send email to this address after commit */
      emailForConfirmation: string | null;
    }
  | { success: false; code: CreateBookingFailureCode };

export type CancelMatchFailureCode = 'MATCH_NOT_FOUND' | 'ALREADY_CANCELLED';

export type CancelMatchResult =
  | {
      success: true;
      cancelledBookings: number;
      refundedAmount: string;
      /** Distinct confirmed-player emails (for match_cancelled after commit) */
      emailsForMatchCancelled: string[];
    }
  | { success: false; code: CancelMatchFailureCode };

export type CancelPlayerBookingFailureCode =
  | 'BOOKING_NOT_FOUND'
  | 'NOT_OWNER'
  | 'NOT_CONFIRMED'
  | 'ALREADY_CANCELLED'
  | 'MATCH_CANCELLED'
  | 'MATCH_PAST'
  | 'TOO_LATE_TO_CANCEL';

export type CancelPlayerBookingResult =
  | {
      success: true;
      cancelledAt: Date;
      /** Always "0.00" — player self-cancel does not refund */
      refundAmount: '0.00';
      playerEmail: string;
    }
  | { success: false; code: CancelPlayerBookingFailureCode };

/** Result of FIFO waitlist promotion (separate transaction after a slot opens). */
export type PromoteWaitlistResult = {
  promotedEmail: string | null;
  skippedEmails: string[];
};

type MatchLockRow = {
  id: string;
  status: string;
  scheduled_at: Date;
  price_per_player: string;
  max_players: number | null;
  is_active: boolean;
  is_future: boolean;
};

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BookingsRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  /**
   * Atomic book: lock match, validate, then confirm (wallet + debit + booking) or waitlist.
   */
  async createBookingForMatch(params: {
    tenantId: string;
    matchId: string;
    userId: string;
  }): Promise<CreateBookingResult> {
    return this.withTransaction(async (client) =>
      this.createBookingInTransaction(client, params),
    );
  }

  private async createBookingInTransaction(
    client: PoolClient,
    params: { tenantId: string; matchId: string; userId: string },
  ): Promise<CreateBookingResult> {
    const { tenantId, matchId, userId } = params;

    const { rows: matchRows } = await this.query<MatchLockRow>(
      client,
      `SELECT
        m.id,
        m.status,
        m.scheduled_at,
        m.price_per_player,
        m.max_players,
        v.is_active,
        (m.scheduled_at > now()) AS is_future
      FROM matches m
      INNER JOIN venues v ON v.id = m.venue_id
      WHERE m.id = $1 AND v.tenant_id = $2
      FOR UPDATE OF m`,
      [matchId, tenantId],
    );

    const match = matchRows[0];
    if (!match) {
      return { success: false, code: 'MATCH_NOT_FOUND' };
    }
    if (match.status === 'cancelled') {
      return { success: false, code: 'MATCH_CANCELLED' };
    }
    if (!match.is_future) {
      return { success: false, code: 'MATCH_PAST' };
    }
    if (!match.is_active) {
      return { success: false, code: 'VENUE_INACTIVE' };
    }

    const { rows: userRows } = await this.query<{
      id: string;
      email: string;
    }>(
      client,
      `SELECT id, email
       FROM users
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND is_active = true
       FOR UPDATE`,
      [userId, tenantId],
    );
    const user = userRows[0];
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND' };
    }

    const { rows: existing } = await this.query<{ id: string }>(
      client,
      `SELECT id FROM bookings
       WHERE match_id = $1 AND user_id = $2
         AND status IN ('pending', 'confirmed')`,
      [matchId, userId],
    );
    if (existing[0]) {
      return { success: false, code: 'ALREADY_BOOKED' };
    }

    const { rows: countRows } = await this.query<{ count: string }>(
      client,
      `SELECT COUNT(*)::text AS count
       FROM bookings
       WHERE match_id = $1 AND status = 'confirmed'`,
      [matchId],
    );
    const confirmedCount = parseInt(countRows[0]?.count ?? '0', 10);
    const maxPlayers = match.max_players;
    const isFull =
      maxPlayers !== null &&
      maxPlayers !== undefined &&
      confirmedCount >= maxPlayers;

    const price = match.price_per_player;

    try {
      if (isFull) {
        const booking = await this.insertBooking(client, {
          matchId,
          userId,
          status: 'pending',
          paidAmount: '0',
        });
        const remainingSpots = this.computeRemainingSpots(
          maxPlayers,
          confirmedCount,
        );
        return {
          success: true,
          booking,
          remainingSpots,
          emailForConfirmation: null,
        };
      }

      const { rows: updated } = await this.query<{ wallet_balance: string }>(
        client,
        `UPDATE users
         SET wallet_balance = wallet_balance - $3::numeric,
             updated_at = now()
         WHERE id = $1
           AND tenant_id = $2
           AND wallet_balance >= $3::numeric
         RETURNING wallet_balance`,
        [userId, tenantId, price],
      );
      if (!updated[0]) {
        return { success: false, code: 'INSUFFICIENT_FUNDS' };
      }

      const booking = await this.insertBooking(client, {
        matchId,
        userId,
        status: 'confirmed',
        paidAmount: price,
      });

      await this.query(
        client,
        `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, 'debit', $3)`,
        [userId, price, booking.id],
      );

      const { rows: afterCount } = await this.query<{ count: string }>(
        client,
        `SELECT COUNT(*)::text AS count
         FROM bookings
         WHERE match_id = $1 AND status = 'confirmed'`,
        [matchId],
      );
      const newConfirmed = parseInt(afterCount[0]?.count ?? '0', 10);
      const remainingSpots = this.computeRemainingSpots(
        maxPlayers,
        newConfirmed,
      );

      return {
        success: true,
        booking,
        remainingSpots,
        emailForConfirmation: user.email,
      };
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === PG_UNIQUE_VIOLATION) {
        return { success: false, code: 'ALREADY_BOOKED' };
      }
      throw err;
    }
  }

  /**
   * Atomic cancel: refund confirmed bookings, cancel waitlist, set match cancelled.
   */
  async cancelMatchForTenant(params: {
    tenantId: string;
    matchId: string;
  }): Promise<CancelMatchResult> {
    return this.withTransaction(async (client) =>
      this.cancelMatchInTransaction(client, params),
    );
  }

  private async cancelMatchInTransaction(
    client: PoolClient,
    params: { tenantId: string; matchId: string },
  ): Promise<CancelMatchResult> {
    const { tenantId, matchId } = params;

    const { rows: matchRows } = await this.query<{
      id: string;
      status: string;
    }>(
      client,
      `SELECT m.id, m.status
       FROM matches m
       INNER JOIN venues v ON v.id = m.venue_id
       WHERE m.id = $1 AND v.tenant_id = $2
       FOR UPDATE OF m`,
      [matchId, tenantId],
    );
    const match = matchRows[0];
    if (!match) {
      return { success: false, code: 'MATCH_NOT_FOUND' };
    }
    if (match.status === 'cancelled') {
      return { success: false, code: 'ALREADY_CANCELLED' };
    }

    await this.query(
      client,
      `SELECT id FROM bookings WHERE match_id = $1 FOR UPDATE`,
      [matchId],
    );

    const { rows: sumRows } = await this.query<{ total: string }>(
      client,
      `SELECT COALESCE(SUM(paid_amount), 0)::text AS total
       FROM bookings
       WHERE match_id = $1 AND status = 'confirmed'`,
      [matchId],
    );
    const refundedAmount = sumRows[0]?.total ?? '0';

    const { rows: confirmedRows } = await this.query<{
      id: string;
      user_id: string;
      paid_amount: string;
      email: string;
    }>(
      client,
      `SELECT b.id, b.user_id, b.paid_amount::text AS paid_amount, u.email
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.match_id = $1 AND b.status = 'confirmed'
       ORDER BY u.id, b.id`,
      [matchId],
    );

    const emailsForMatchCancelled: string[] = [];
    for (const row of confirmedRows) {
      emailsForMatchCancelled.push(row.email);

      await this.query(
        client,
        `UPDATE users
         SET wallet_balance = wallet_balance + $3::numeric,
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [row.user_id, tenantId, row.paid_amount],
      );

      await this.query(
        client,
        `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, 'refund', $3)`,
        [row.user_id, row.paid_amount, row.id],
      );

      await this.query(
        client,
        `UPDATE bookings
         SET status = 'cancelled'::booking_status,
             cancelled_at = now(),
             refunded_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [row.id],
      );
    }

    const pendingResult = await this.query(
      client,
      `UPDATE bookings
       SET status = 'cancelled'::booking_status,
           cancelled_at = now(),
           updated_at = now()
       WHERE match_id = $1 AND status = 'pending'`,
      [matchId],
    );
    const pendingCancelled = pendingResult.rowCount ?? 0;

    await this.query(
      client,
      `UPDATE matches
       SET status = 'cancelled'::match_status,
           updated_at = now()
       WHERE id = $1`,
      [matchId],
    );

    const cancelledBookings = confirmedRows.length + pendingCancelled;

    return {
      success: true,
      cancelledBookings,
      refundedAmount,
      emailsForMatchCancelled,
    };
  }

  /**
   * Player cancels own confirmed booking: no refund. Waitlist promotion runs after commit via
   * promoteWaitlistForMatch (separate transaction).
   */
  async cancelBookingForPlayer(params: {
    tenantId: string;
    matchId: string;
    bookingId: string;
    userId: string;
    cancelCutoffHours: number;
  }): Promise<CancelPlayerBookingResult> {
    return this.withTransaction(async (client) =>
      this.cancelPlayerBookingInTransaction(client, params),
    );
  }

  private async cancelPlayerBookingInTransaction(
    client: PoolClient,
    params: {
      tenantId: string;
      matchId: string;
      bookingId: string;
      userId: string;
      cancelCutoffHours: number;
    },
  ): Promise<CancelPlayerBookingResult> {
    const { tenantId, matchId, bookingId, userId, cancelCutoffHours } = params;

    const { rows: lockRows } = await this.query<{
      bid: string;
      b_user_id: string;
      b_status: string;
      match_status: string;
      scheduled_at: Date;
      price_per_player: string;
      user_email: string;
      is_future: boolean;
      can_cancel: boolean;
    }>(
      client,
      `SELECT
         b.id AS bid,
         b.user_id AS b_user_id,
         b.status AS b_status,
         m.status AS match_status,
         m.scheduled_at,
         m.price_per_player::text AS price_per_player,
         u.email AS user_email,
         (m.scheduled_at > now()) AS is_future,
         (m.scheduled_at >= now() + interval '1 hour' * $4) AS can_cancel
       FROM bookings b
       INNER JOIN matches m ON m.id = b.match_id
       INNER JOIN venues v ON v.id = m.venue_id
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 AND b.match_id = $2 AND v.tenant_id = $3
       FOR UPDATE OF b, m`,
      [bookingId, matchId, tenantId, cancelCutoffHours],
    );

    const row = lockRows[0];
    if (!row) {
      return { success: false, code: 'BOOKING_NOT_FOUND' };
    }
    if (row.b_user_id !== userId) {
      return { success: false, code: 'NOT_OWNER' };
    }
    if (row.b_status === 'cancelled') {
      return { success: false, code: 'ALREADY_CANCELLED' };
    }
    if (row.b_status !== 'confirmed') {
      return { success: false, code: 'NOT_CONFIRMED' };
    }
    if (row.match_status === 'cancelled') {
      return { success: false, code: 'MATCH_CANCELLED' };
    }
    if (!row.is_future) {
      return { success: false, code: 'MATCH_PAST' };
    }
    if (!row.can_cancel) {
      return { success: false, code: 'TOO_LATE_TO_CANCEL' };
    }

    const { rows: updatedRows } = await this.query<{ cancelled_at: Date }>(
      client,
      `UPDATE bookings
       SET status = 'cancelled'::booking_status,
           cancelled_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING cancelled_at`,
      [bookingId],
    );
    const cancelledAt = updatedRows[0]?.cancelled_at;
    if (!cancelledAt) {
      throw new Error('cancelPlayerBooking: expected cancelled_at');
    }

    return {
      success: true,
      cancelledAt,
      refundAmount: '0.00',
      playerEmail: row.user_email,
    };
  }

  /**
   * FIFO promote one waitlisted player after a confirmed slot opens.
   * Run in a new transaction after the cancellation commit. Not used when a match is cancelled.
   * Skips entries with insufficient wallet (deduction = DB type `debit`) and continues.
   * Match must be future and not cancelled/completed/in_progress — aligned with bookable matches
   * (same idea as createBookingInTransaction: not cancelled + scheduled_at > now()).
   */
  async promoteWaitlistForMatch(params: {
    tenantId: string;
    matchId: string;
  }): Promise<PromoteWaitlistResult> {
    return this.withTransaction(async (client) =>
      this.promoteWaitlistInTransaction(client, params),
    );
  }

  private async promoteWaitlistInTransaction(
    client: PoolClient,
    params: { tenantId: string; matchId: string },
  ): Promise<PromoteWaitlistResult> {
    const { tenantId, matchId } = params;

    const { rows: matchRows } = await this.query<{
      id: string;
      status: string;
      price_per_player: string;
      max_players: number | null;
    }>(
      client,
      `SELECT m.id, m.status::text AS status, m.price_per_player::text AS price_per_player, m.max_players
       FROM matches m
       INNER JOIN venues v ON v.id = m.venue_id
       WHERE m.id = $1 AND v.tenant_id = $2
         AND m.status NOT IN ('cancelled', 'completed', 'in_progress')
         AND m.scheduled_at > now()
       FOR UPDATE OF m`,
      [matchId, tenantId],
    );
    const match = matchRows[0];
    if (!match) {
      return { promotedEmail: null, skippedEmails: [] };
    }

    const price = match.price_per_player;

    const { rows: countRows } = await this.query<{ c: string }>(
      client,
      `SELECT COUNT(*)::text AS c FROM bookings WHERE match_id = $1 AND status = 'pending'`,
      [matchId],
    );
    const waitlistCount = parseInt(countRows[0]?.c ?? '0', 10);
    if (waitlistCount === 0) {
      return { promotedEmail: null, skippedEmails: [] };
    }

    const { rows: confirmedRows } = await this.query<{ c: string }>(
      client,
      `SELECT COUNT(*)::text AS c FROM bookings WHERE match_id = $1 AND status = 'confirmed'`,
      [matchId],
    );
    const confirmedCount = parseInt(confirmedRows[0]?.c ?? '0', 10);
    const maxP = match.max_players;
    if (maxP !== null && maxP !== undefined && confirmedCount >= maxP) {
      return { promotedEmail: null, skippedEmails: [] };
    }

    const { rows: pendingList } = await this.query<{
      id: string;
      user_id: string;
      email: string;
    }>(
      client,
      `SELECT b.id, b.user_id, u.email
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.match_id = $1 AND b.status = 'pending'
       ORDER BY b.created_at ASC`,
      [matchId],
    );

    const skippedEmails: string[] = [];
    const maxIterations = pendingList.length;

    for (let i = 0; i < maxIterations; i++) {
      const candidate = pendingList[i];
      if (!candidate) {
        break;
      }

      const { rows: locked } = await this.query<{ id: string }>(
        client,
        `SELECT b.id
         FROM bookings b
         WHERE b.id = $1 AND b.match_id = $2 AND b.status = 'pending'
         FOR UPDATE OF b`,
        [candidate.id, matchId],
      );
      if (!locked[0]) {
        continue;
      }

      await this.query(
        client,
        `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [candidate.user_id, tenantId],
      );

      const { rows: debited } = await this.query<{ wallet_balance: string }>(
        client,
        `UPDATE users
         SET wallet_balance = wallet_balance - $3::numeric,
             updated_at = now()
         WHERE id = $1
           AND tenant_id = $2
           AND wallet_balance >= $3::numeric
         RETURNING wallet_balance`,
        [candidate.user_id, tenantId, price],
      );
      if (!debited[0]) {
        skippedEmails.push(candidate.email);
        continue;
      }

      await this.query(
        client,
        `UPDATE bookings
         SET status = 'confirmed'::booking_status,
             paid_amount = $2::numeric,
             updated_at = now()
         WHERE id = $1`,
        [candidate.id, price],
      );
      await this.query(
        client,
        `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, 'debit', $3)`,
        [candidate.user_id, price, candidate.id],
      );

      return {
        promotedEmail: candidate.email,
        skippedEmails,
      };
    }

    return { promotedEmail: null, skippedEmails };
  }

  private computeRemainingSpots(
    maxPlayers: number | null,
    confirmedCount: number,
  ): number | null {
    if (maxPlayers === null || maxPlayers === undefined) {
      return null;
    }
    return Math.max(0, maxPlayers - confirmedCount);
  }

  private async insertBooking(
    client: PoolClient,
    params: {
      matchId: string;
      userId: string;
      status: string;
      paidAmount: string;
    },
  ): Promise<BookingRow> {
    const { rows } = await this.query<BookingRow>(
      client,
      `INSERT INTO bookings (match_id, user_id, status, paid_amount)
       VALUES ($1, $2, $3::booking_status, $4)
       RETURNING
         id,
         match_id,
         user_id,
         status,
         paid_amount,
         created_at,
         updated_at`,
      [params.matchId, params.userId, params.status, params.paidAmount],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('insertBooking: expected one row');
    }
    return row;
  }

  /**
   * Paginated booking history for a user in a tenant (JOIN bookings, matches, venues).
   */
  async countMyBookingsForUser(params: {
    tenantId: string;
    userId: string;
    status?: 'confirmed' | 'cancelled' | 'waitlisted';
    upcoming?: boolean;
  }): Promise<number> {
    const { whereSql, values } =
      BookingsRepository.buildMyBookingsFilters(params);
    const { rows } = await this.query<{ c: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS c
       FROM bookings b
       INNER JOIN matches m ON m.id = b.match_id
       INNER JOIN venues v ON v.id = m.venue_id
       WHERE ${whereSql}`,
      values,
    );
    return parseInt(rows[0]?.c ?? '0', 10);
  }

  async findMyBookingsForUser(params: {
    tenantId: string;
    userId: string;
    status?: 'confirmed' | 'cancelled' | 'waitlisted';
    upcoming?: boolean;
    limit: number;
    offset: number;
  }): Promise<MyBookingHistoryRow[]> {
    const { whereSql, values } =
      BookingsRepository.buildMyBookingsFilters(params);
    const limit = params.limit;
    const offset = params.offset;
    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const { rows } = await this.query<MyBookingHistoryRow>(
      this.pool,
      `SELECT
         b.id,
         b.status,
         b.paid_amount::text AS paid_amount,
         m.title AS match_title,
         m.sport_type::text AS sport_type,
         m.scheduled_at,
         v.name AS venue_name,
         b.created_at
       FROM bookings b
       INNER JOIN matches m ON m.id = b.match_id
       INNER JOIN venues v ON v.id = m.venue_id
       WHERE ${whereSql}
       ORDER BY m.scheduled_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...values, limit, offset],
    );
    return rows;
  }

  /**
   * Booking + match + venue for tenant. Caller enforces auth (user or admin).
   */
  async findBookingDetailForTenant(params: {
    bookingId: string;
    tenantId: string;
  }): Promise<BookingDetailRow | null> {
    const { rows } = await this.query<BookingDetailRow>(
      this.pool,
      `SELECT
         b.id,
         b.match_id,
         b.user_id,
         b.status::text AS status,
         b.paid_amount::text AS paid_amount,
         b.cancelled_at,
         b.refunded_at,
         b.created_at,
         m.venue_id AS match_venue_id,
         m.title AS match_title,
         m.sport_type::text AS sport_type,
         m.scheduled_at,
         m.duration_mins,
         m.price_per_player::text AS price_per_player,
         m.status::text AS match_status,
         m.max_players,
         m.created_at AS match_created_at,
         m.updated_at AS match_updated_at,
         v.id AS venue_id,
         v.name AS venue_name,
         v.address,
         v.maps_url,
         v.picture_url,
         v.sport_types,
         v.is_active AS venue_is_active,
         v.created_at AS venue_created_at,
         v.updated_at AS venue_updated_at
       FROM bookings b
       INNER JOIN matches m ON m.id = b.match_id
       INNER JOIN venues v ON v.id = m.venue_id
       WHERE b.id = $1 AND v.tenant_id = $2`,
      [params.bookingId, params.tenantId],
    );
    return rows[0] ?? null;
  }

  private static buildMyBookingsFilters(params: {
    userId: string;
    tenantId: string;
    status?: 'confirmed' | 'cancelled' | 'waitlisted';
    upcoming?: boolean;
  }): { whereSql: string; values: unknown[] } {
    const values: unknown[] = [];
    const parts: string[] = [];
    let n = 1;

    parts.push(`b.user_id = $${n++}`);
    values.push(params.userId);
    parts.push(`v.tenant_id = $${n++}`);
    values.push(params.tenantId);

    if (params.status === 'waitlisted') {
      parts.push(`b.status = 'pending'`);
    } else if (params.status === 'confirmed' || params.status === 'cancelled') {
      parts.push(`b.status = $${n++}::booking_status`);
      values.push(params.status);
    }

    if (params.upcoming === true) {
      parts.push('m.scheduled_at > now()');
    }

    return { whereSql: parts.join(' AND '), values };
  }
}
