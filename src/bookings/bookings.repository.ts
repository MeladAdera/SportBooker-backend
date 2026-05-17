import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';
import { BookingPosition, MAX_GOALKEEPERS_PER_MATCH } from './booking-position';
import { WAITLIST_PREPAID_NOTICE } from './waitlist-notice';

export type BookingRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  paid_amount: string;
  position: string;
  created_at: Date;
  updated_at: Date;
};

/** Row for GET /users/me/bookings (joined query). */
export type MyBookingHistoryRow = {
  id: string;
  match_id: string;
  status: string;
  paid_amount: string;
  match_title: string;
  sport_type: string;
  scheduled_at: Date;
  venue_name: string;
  venue_picture_url: string | null;
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
  position: string;
  /** 1-based FIFO position when status='pending'; null otherwise */
  waitlist_position: number | null;
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
  | 'USER_BANNED'
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
      /** When status is pending (waitlist): prepaid notice for API consumers */
      waitlistNotice: string | null;
      /** 1-based FIFO queue position when waitlisted; null when confirmed */
      waitlistPosition: number | null;
    }
  | { success: false; code: CreateBookingFailureCode };

export type CancelMatchFailureCode =
  | 'MATCH_NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'MATCH_ALREADY_ENDED';

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
  | 'MATCH_PAST';

export type CancelPlayerBookingResult =
  | {
      success: true;
      cancelledAt: Date;
      /** Prepaid waitlist: full refund. Confirmed: refund paid_amount only if cancel is ≥ cancel_cutoff_hours before match; else "0.00". */
      refundAmount: string;
      playerEmail: string;
      /** True when a confirmed spot was freed (run waitlist promotion). False for waitlist cancel. */
      shouldPromoteWaitlist: boolean;
    }
  | { success: false; code: CancelPlayerBookingFailureCode };

/** Result of FIFO waitlist promotion (separate transaction after a slot opens). */
export type PromoteWaitlistResult = {
  promotedEmail: string | null;
  skippedEmails: string[];
};

export type ExpiredWaitlistRefundRow = {
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  matchId: string;
  matchTitle: string;
  venueName: string;
  scheduledAt: Date;
  refundAmount: string;
};

export type RemoveFromWaitlistFailureCode = 'BOOKING_NOT_FOUND' | 'NOT_PENDING';

export type RemoveFromWaitlistResult =
  | {
      success: true;
      refundAmount: string;
      playerEmail: string;
    }
  | { success: false; code: RemoveFromWaitlistFailureCode };

type MatchLockRow = {
  id: string;
  status: string;
  scheduled_at: Date;
  price_per_player: string;
  max_players: number | null;
  is_fake: boolean;
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
    position: BookingPosition;
  }): Promise<CreateBookingResult> {
    return this.withTransaction(async (client) =>
      this.createBookingInTransaction(client, params),
    );
  }

  private async createBookingInTransaction(
    client: PoolClient,
    params: {
      tenantId: string;
      matchId: string;
      userId: string;
      position: BookingPosition;
    },
  ): Promise<CreateBookingResult> {
    const { tenantId, matchId, userId, position } = params;

    const { rows: matchRows } = await this.query<MatchLockRow>(
      client,
      `SELECT
        m.id,
        m.status,
        m.scheduled_at,
        m.price_per_player,
        m.max_players,
        m.is_fake,
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
      banned_at: Date | null;
      banned_until: Date | null;
    }>(
      client,
      `SELECT id, email, banned_at, banned_until
       FROM users
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND is_active = true
       FOR UPDATE`,
      [userId, tenantId],
    );
    const user = userRows[0];
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND' };
    }

    const isActiveBan =
      user.banned_at != null &&
      (user.banned_until == null || user.banned_until > new Date());
    if (isActiveBan) {
      return { success: false, code: 'USER_BANNED' };
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

    const { rows: countRows } = await this.query<{
      count: string;
      fake_count: string;
    }>(
      client,
      `SELECT
         COUNT(*)::text AS count,
         COUNT(*) FILTER (WHERE u.is_fake = true)::text AS fake_count
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.match_id = $1 AND b.status = 'confirmed'`,
      [matchId],
    );
    let confirmedCount = parseInt(countRows[0]?.count ?? '0', 10);
    const fakeConfirmedCount = parseInt(countRows[0]?.fake_count ?? '0', 10);

    const { rows: gkRows } = await this.query<{ count: string }>(
      client,
      `SELECT COUNT(*)::text AS count
       FROM bookings
       WHERE match_id = $1
         AND status = 'confirmed'
         AND position = 'goalkeeper'::booking_position`,
      [matchId],
    );
    const confirmedGkCount = parseInt(gkRows[0]?.count ?? '0', 10);

    const maxPlayers = match.max_players;
    let isFull =
      maxPlayers !== null &&
      maxPlayers !== undefined &&
      confirmedCount >= maxPlayers;

    if (
      isFull &&
      match.is_fake &&
      fakeConfirmedCount > 0 &&
      maxPlayers !== null &&
      maxPlayers !== undefined
    ) {
      const { rows: bumpRows } = await this.query<{ id: string }>(
        client,
        `DELETE FROM bookings
         WHERE id = (
           SELECT b.id
           FROM bookings b
           INNER JOIN users u ON u.id = b.user_id
           WHERE b.match_id = $1
             AND b.status = 'confirmed'
             AND u.is_fake = true
           ORDER BY b.created_at DESC
           LIMIT 1
         )
         RETURNING id`,
        [matchId],
      );
      if (bumpRows[0]) {
        confirmedCount -= 1;
        isFull = confirmedCount >= maxPlayers;
      }
    }

    const goalkeeperSlotsFull = confirmedGkCount >= MAX_GOALKEEPERS_PER_MATCH;
    const wantsGoalkeeper = position === BookingPosition.Goalkeeper;
    /** GK slots taken but match still has outfield capacity — join waitlist as GK. */
    const mustWaitlistForGoalkeeper =
      wantsGoalkeeper && goalkeeperSlotsFull && !isFull;

    const price = match.price_per_player;

    try {
      if (isFull || mustWaitlistForGoalkeeper) {
        const { rows: prepaid } = await this.query<{ wallet_balance: string }>(
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
        if (!prepaid[0]) {
          return { success: false, code: 'INSUFFICIENT_FUNDS' };
        }

        const booking = await this.insertBooking(client, {
          matchId,
          userId,
          status: 'pending',
          paidAmount: price,
          position,
        });

        await this.query(
          client,
          `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
           VALUES ($1, $2, 'debit', $3)`,
          [userId, price, booking.id],
        );

        const { rows: posRows } = await this.query<{ pos: string }>(
          client,
          `SELECT COUNT(*)::text AS pos
           FROM bookings
           WHERE match_id = $1 AND status = 'pending'`,
          [matchId],
        );
        const waitlistPosition = parseInt(posRows[0]?.pos ?? '1', 10);

        const remainingSpots = this.computeRemainingSpots(
          maxPlayers,
          confirmedCount,
        );
        return {
          success: true,
          booking,
          remainingSpots,
          emailForConfirmation: null,
          waitlistNotice: WAITLIST_PREPAID_NOTICE,
          waitlistPosition,
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
        position,
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
        waitlistNotice: null,
        waitlistPosition: null,
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
   * Uses bulk UPDATE/INSERT (O(3) queries) instead of per-row loop.
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
      has_ended: boolean;
    }>(
      client,
      `SELECT m.id, m.status,
        (m.status = 'scheduled'::match_status
          AND now() >= m.scheduled_at + (m.duration_mins * interval '1 minute')) AS has_ended
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
    if (match.has_ended) {
      return { success: false, code: 'MATCH_ALREADY_ENDED' };
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
       WHERE match_id = $1 AND status IN ('confirmed', 'pending')`,
      [matchId],
    );
    const refundedAmount = sumRows[0]?.total ?? '0';

    const { rows: confirmedRows } = await this.query<{
      id: string;
      user_id: string;
      paid_amount: string;
      email: string;
      is_fake: boolean;
    }>(
      client,
      `SELECT b.id, b.user_id, b.paid_amount::text AS paid_amount, u.email, u.is_fake
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.match_id = $1 AND b.status = 'confirmed'
       ORDER BY u.id, b.id`,
      [matchId],
    );

    const emailsForMatchCancelled = confirmedRows
      .filter((r) => !r.is_fake)
      .map((r) => r.email);

    if (confirmedRows.length > 0) {
      // Bulk-refund wallets (one UPDATE with JOIN from bookings confirmed set).
      await this.query(
        client,
        `UPDATE users u
         SET wallet_balance = u.wallet_balance + b.paid_amount,
             updated_at = now()
         FROM bookings b
         WHERE b.match_id = $1
           AND b.status = 'confirmed'
           AND u.id = b.user_id
           AND u.tenant_id = $2`,
        [matchId, tenantId],
      );

      // Bulk-insert refund transaction records.
      await this.query(
        client,
        `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         SELECT b.user_id, b.paid_amount, 'refund'::wallet_tx_type, b.id
         FROM bookings b
         WHERE b.match_id = $1 AND b.status = 'confirmed'`,
        [matchId],
      );

      // Bulk-cancel confirmed bookings (including refunded_at timestamp).
      await this.query(
        client,
        `UPDATE bookings
         SET status = 'cancelled'::booking_status,
             cancelled_at = now(),
             refunded_at = now(),
             updated_at = now()
         WHERE match_id = $1 AND status = 'confirmed'`,
        [matchId],
      );
    }

    await this.query(
      client,
      `UPDATE users u
       SET wallet_balance = u.wallet_balance + b.paid_amount,
           updated_at = now()
       FROM bookings b
       WHERE b.match_id = $1
         AND b.status = 'pending'
         AND b.paid_amount > 0
         AND u.id = b.user_id
         AND u.tenant_id = $2`,
      [matchId, tenantId],
    );

    await this.query(
      client,
      `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
       SELECT b.user_id, b.paid_amount, 'refund'::wallet_tx_type, b.id
       FROM bookings b
       WHERE b.match_id = $1 AND b.status = 'pending' AND b.paid_amount > 0`,
      [matchId],
    );

    const pendingResult = await this.query(
      client,
      `UPDATE bookings
       SET status = 'cancelled'::booking_status,
           cancelled_at = now(),
           refunded_at = CASE
             WHEN paid_amount > 0 THEN now()
             ELSE refunded_at
           END,
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
   * Player cancels own confirmed booking: allowed until match start. Full wallet refund of
   * `paid_amount` only when `scheduled_at >= now() + cancel_cutoff_hours`; inside that window,
   * cancel still succeeds with no refund. Waitlist promotion runs after commit via promoteWaitlistForMatch.
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
      b_paid_amount: string;
      match_status: string;
      scheduled_at: Date;
      price_per_player: string;
      user_email: string;
      is_future: boolean;
      /** Match start at least `cancel_cutoff_hours` away — confirmed cancel refunds `paid_amount`. */
      refund_eligible: boolean;
    }>(
      client,
      `SELECT
         b.id AS bid,
         b.user_id AS b_user_id,
         b.status AS b_status,
         b.paid_amount::text AS b_paid_amount,
         m.status AS match_status,
         m.scheduled_at,
         m.price_per_player::text AS price_per_player,
         u.email AS user_email,
         (m.scheduled_at > now()) AS is_future,
         (m.scheduled_at >= now() + interval '1 hour' * $4) AS refund_eligible
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
    if (row.match_status === 'cancelled') {
      return { success: false, code: 'MATCH_CANCELLED' };
    }

    if (row.b_status === 'pending') {
      if (!row.is_future) {
        return { success: false, code: 'MATCH_PAST' };
      }
      const prepaid = parseFloat(row.b_paid_amount ?? '0') > 0;
      if (prepaid) {
        await this.query(
          client,
          `UPDATE users
           SET wallet_balance = wallet_balance + $3::numeric,
               updated_at = now()
           WHERE id = $1 AND tenant_id = $2`,
          [userId, tenantId, row.b_paid_amount],
        );
        await this.query(
          client,
          `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
           VALUES ($1, $2, 'refund', $3)`,
          [userId, row.b_paid_amount, bookingId],
        );
        const { rows: updatedRows } = await this.query<{ cancelled_at: Date }>(
          client,
          `UPDATE bookings
           SET status = 'cancelled'::booking_status,
               cancelled_at = now(),
               refunded_at = now(),
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
          refundAmount: row.b_paid_amount,
          playerEmail: row.user_email,
          shouldPromoteWaitlist: false,
        };
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
        shouldPromoteWaitlist: false,
      };
    }

    if (row.b_status !== 'confirmed') {
      return { success: false, code: 'NOT_CONFIRMED' };
    }
    if (!row.is_future) {
      return { success: false, code: 'MATCH_PAST' };
    }

    const confirmedPrepaid = parseFloat(row.b_paid_amount ?? '0') > 0;
    if (row.refund_eligible && confirmedPrepaid) {
      await this.query(
        client,
        `UPDATE users
         SET wallet_balance = wallet_balance + $3::numeric,
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId, row.b_paid_amount],
      );
      await this.query(
        client,
        `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, 'refund', $3)`,
        [userId, row.b_paid_amount, bookingId],
      );
      const { rows: updatedRows } = await this.query<{ cancelled_at: Date }>(
        client,
        `UPDATE bookings
         SET status = 'cancelled'::booking_status,
             cancelled_at = now(),
             refunded_at = now(),
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
        refundAmount: row.b_paid_amount,
        playerEmail: row.user_email,
        shouldPromoteWaitlist: true,
      };
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
      shouldPromoteWaitlist: true,
    };
  }

  /**
   * FIFO promote one waitlisted player after a confirmed slot opens.
   * Run in a new transaction after the cancellation commit. Not used when a match is cancelled.
   * Skips entries with insufficient wallet (deduction = DB type `debit`) and continues.
   * Match must be scheduled (stored status), future kickoff — same gate as booking.
   * Stored match_status is only `scheduled` | `cancelled`; never compare to computed labels.
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
         AND m.status = 'scheduled'::match_status
         AND m.scheduled_at > now()
       FOR UPDATE OF m`,
      [matchId, tenantId],
    );
    const match = matchRows[0];
    if (!match) {
      return { promotedEmail: null, skippedEmails: [] };
    }

    const price = match.price_per_player;

    const { rows: pendingList } = await this.query<{
      id: string;
      user_id: string;
      email: string;
      position: string;
      paid_amount: string;
    }>(
      client,
      `SELECT b.id, b.user_id, u.email, b.position::text AS position,
              b.paid_amount::text AS paid_amount
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.match_id = $1 AND b.status = 'pending'
       ORDER BY b.created_at ASC`,
      [matchId],
    );
    if (pendingList.length === 0) {
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

      const { rows: capRows } = await this.query<{
        total: string;
        gk: string;
      }>(
        client,
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE b.position = 'goalkeeper'::booking_position)::text AS gk
         FROM bookings b
         WHERE b.match_id = $1 AND b.status = 'confirmed'`,
        [matchId],
      );
      const confirmedTotal = parseInt(capRows[0]?.total ?? '0', 10);
      const confirmedGk = parseInt(capRows[0]?.gk ?? '0', 10);
      const maxCap = match.max_players;

      if (maxCap !== null && maxCap !== undefined && confirmedTotal >= maxCap) {
        continue;
      }
      const role = candidate.position as BookingPosition;
      if (
        role === BookingPosition.Goalkeeper &&
        confirmedGk >= MAX_GOALKEEPERS_PER_MATCH
      ) {
        continue;
      }

      await this.query(
        client,
        `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [candidate.user_id, tenantId],
      );

      const prepaidWaitlist = parseFloat(candidate.paid_amount) > 0;

      if (!prepaidWaitlist) {
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
      } else {
        await this.query(
          client,
          `UPDATE bookings
           SET status = 'confirmed'::booking_status,
               updated_at = now()
           WHERE id = $1`,
          [candidate.id],
        );
      }

      return {
        promotedEmail: candidate.email,
        skippedEmails,
      };
    }

    return { promotedEmail: null, skippedEmails };
  }

  /**
   * Admin removes a player from the waitlist. Refunds prepaid amount if any.
   * Does NOT trigger waitlist promotion (no confirmed spot freed).
   */
  async removeFromWaitlistForTenant(params: {
    tenantId: string;
    matchId: string;
    bookingId: string;
  }): Promise<RemoveFromWaitlistResult> {
    return this.withTransaction(async (client) => {
      const { tenantId, matchId, bookingId } = params;

      const { rows: lockRows } = await this.query<{
        bid: string;
        b_status: string;
        b_user_id: string;
        b_paid_amount: string;
        user_email: string;
      }>(
        client,
        `SELECT
           b.id AS bid,
           b.status::text AS b_status,
           b.user_id AS b_user_id,
           b.paid_amount::text AS b_paid_amount,
           u.email AS user_email
         FROM bookings b
         INNER JOIN matches m ON m.id = b.match_id
         INNER JOIN venues v ON v.id = m.venue_id
         INNER JOIN users u ON u.id = b.user_id
         WHERE b.id = $1 AND b.match_id = $2 AND v.tenant_id = $3
         FOR UPDATE OF b`,
        [bookingId, matchId, tenantId],
      );

      const row = lockRows[0];
      if (!row) {
        return { success: false, code: 'BOOKING_NOT_FOUND' };
      }
      if (row.b_status !== 'pending') {
        return { success: false, code: 'NOT_PENDING' };
      }

      const prepaid = parseFloat(row.b_paid_amount ?? '0') > 0;
      if (prepaid) {
        await this.query(
          client,
          `UPDATE users
           SET wallet_balance = wallet_balance + $2::numeric,
               updated_at = now()
           WHERE id = $1`,
          [row.b_user_id, row.b_paid_amount],
        );
        await this.query(
          client,
          `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
           VALUES ($1, $2, 'refund', $3)`,
          [row.b_user_id, row.b_paid_amount, bookingId],
        );
      }

      await this.query(
        client,
        `UPDATE bookings
         SET status = 'cancelled'::booking_status,
             cancelled_at = now(),
             refunded_at = CASE WHEN paid_amount > 0 THEN now() ELSE refunded_at END,
             updated_at = now()
         WHERE id = $1`,
        [bookingId],
      );

      return {
        success: true,
        refundAmount: prepaid ? row.b_paid_amount : '0.00',
        playerEmail: row.user_email,
      };
    });
  }

  /**
   * Expires waitlist entries for matches that have already ended.
   * Pending bookings are cancelled; prepaid ones are refunded to wallet.
   * Uses row-level locks with SKIP LOCKED so concurrent runs do not double-process.
   */
  async refundExpiredWaitlistBookings(): Promise<ExpiredWaitlistRefundRow[]> {
    return this.withTransaction(async (client) => {
      const { rows } = await this.query<{
        booking_id: string;
        user_id: string;
        user_email: string;
        user_name: string;
        match_id: string;
        match_title: string;
        venue_name: string;
        scheduled_at: Date;
        refund_amount: string;
      }>(
        client,
        `WITH expired_pending AS (
           SELECT
             b.id AS booking_id,
             b.user_id,
             b.paid_amount,
             b.paid_amount::text AS paid_amount_text,
             u.email AS user_email,
             u.name AS user_name,
             m.id AS match_id,
             m.title AS match_title,
             v.name AS venue_name,
             m.scheduled_at
           FROM bookings b
           INNER JOIN matches m ON m.id = b.match_id
           INNER JOIN venues v ON v.id = m.venue_id
           INNER JOIN users u ON u.id = b.user_id AND u.tenant_id = v.tenant_id
           WHERE b.status = 'pending'
             AND m.status = 'scheduled'::match_status
             AND now() >= m.scheduled_at + (m.duration_mins * interval '1 minute')
           FOR UPDATE OF b SKIP LOCKED
         ),
         refunded AS (
           UPDATE users u
           SET wallet_balance = u.wallet_balance + e.paid_amount,
               updated_at = now()
           FROM expired_pending e
           WHERE u.id = e.user_id
             AND e.paid_amount > 0
           RETURNING
             e.booking_id,
             e.user_id,
             e.user_email,
             e.user_name,
             e.match_id,
             e.match_title,
             e.venue_name,
             e.scheduled_at,
             e.paid_amount_text AS refund_amount
         ),
         refund_transactions AS (
           INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
           SELECT r.user_id, r.refund_amount::numeric, 'refund'::wallet_tx_type, r.booking_id
           FROM refunded r
         ),
         cancelled AS (
           UPDATE bookings b
           SET status = 'cancelled'::booking_status,
               cancelled_at = now(),
               refunded_at = CASE
                 WHEN e.paid_amount > 0 THEN now()
                 ELSE refunded_at
               END,
               updated_at = now()
           FROM expired_pending e
           WHERE b.id = e.booking_id
           RETURNING b.id
         )
         SELECT
           r.booking_id,
           r.user_id,
           r.user_email,
           r.user_name,
           r.match_id,
           r.match_title,
           r.venue_name,
           r.scheduled_at,
           r.refund_amount
         FROM refunded r`,
      );

      return rows.map((row) => ({
        bookingId: row.booking_id,
        userId: row.user_id,
        userEmail: row.user_email,
        userName: row.user_name,
        matchId: row.match_id,
        matchTitle: row.match_title,
        venueName: row.venue_name,
        scheduledAt: row.scheduled_at,
        refundAmount: row.refund_amount,
      }));
    });
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
      position: BookingPosition;
    },
  ): Promise<BookingRow> {
    const { rows } = await this.query<BookingRow>(
      client,
      `INSERT INTO bookings (match_id, user_id, status, paid_amount, position)
       VALUES ($1, $2, $3::booking_status, $4, $5::booking_position)
       RETURNING
         id,
         match_id,
         user_id,
         status,
         paid_amount,
         position::text AS position,
         created_at,
         updated_at`,
      [
        params.matchId,
        params.userId,
        params.status,
        params.paidAmount,
        params.position,
      ],
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
         m.id AS match_id,
         b.status,
         b.paid_amount::text AS paid_amount,
         m.title AS match_title,
         m.sport_type::text AS sport_type,
         m.scheduled_at,
         v.name AS venue_name,
         v.picture_url AS venue_picture_url,
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
         b.position::text AS position,
         b.cancelled_at,
         b.refunded_at,
         b.created_at,
         CASE WHEN b.status = 'pending' THEN (
           SELECT COUNT(*)::int
           FROM bookings b2
           WHERE b2.match_id = b.match_id
             AND b2.status = 'pending'
             AND b2.created_at <= b.created_at
         ) END AS waitlist_position,
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

  /**
   * Returns distinct match IDs where the given user had confirmed bookings that were cancelled
   * (used after a ban to trigger waitlist promotion per match).
   * Looks for bookings cancelled within the last 10 seconds scoped to future matches.
   */
  async getMatchIdsWithFreedConfirmedSlotsForUser(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const { rows } = await this.query<{ match_id: string }>(
      this.pool,
      `SELECT DISTINCT b.match_id
       FROM bookings b
       INNER JOIN matches m ON m.id = b.match_id
       INNER JOIN venues  v ON v.id = m.venue_id
       WHERE b.user_id     = $1
         AND v.tenant_id   = $2
         AND b.status      = 'cancelled'
         AND b.cancelled_at >= NOW() - INTERVAL '10 seconds'
         AND m.scheduled_at > NOW()
         AND m.status <> 'cancelled'`,
      [userId, tenantId],
    );
    return rows.map((r) => r.match_id);
  }
}
