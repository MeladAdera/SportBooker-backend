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
      `SELECT id FROM bookings WHERE match_id = $1 AND user_id = $2`,
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
}
