import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository, type DbExecutor } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type UserRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UserForLoginRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string | null;
  email_verified_at: Date | null;
  photo_url: string | null;
  deleted_at: Date | null;
  is_active: boolean | null;
  is_fake: boolean;
  banned_at: Date | null;
  banned_until: Date | null;
};

export type RegisteredUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: Date;
};

export type ForgotPasswordUserRow = {
  id: string;
  name: string;
  email: string;
};

export type UnverifiedUserRow = {
  id: string;
  name: string;
  email: string;
};

/** Row for GET /users (tenant staff list). */
export type TenantUserListRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_fake: boolean;
  wallet_balance: string;
  banned_at: Date | null;
  banned_until: Date | null;
  created_at: Date;
};

/** Returned to admin tooling after fake-player creation. */
export type FakePlayerRow = {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  skill_level: string | null;
  preferred_position: string | null;
  dominant_foot: string | null;
  preferred_days: string[];
  created_at: Date;
};

/** Row for GET /users/:userId (tenant staff detail). */
export type TenantUserDetailRow = {
  id: string;
  name: string;
  email: string;
  phone: string | number | null;
  photo_url: string | null;
  role: string;
  is_active: boolean;
  is_fake: boolean;
  /** pg `numeric` — use Number() when mapping to API */
  wallet_balance: string;
  banned_at: Date | null;
  banned_until: Date | null;
  ban_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

/** Row for GET /users/me; includes deleted_at to distinguish soft-deleted users. */
export type UserSelfProfileRow = {
  id: string;
  name: string;
  email: string;
  phone: string | number | null;
  photo_url: string | null;
  role: string;
  /** pg `numeric` — use Number() when mapping to API */
  wallet_balance: string;
  created_at: Date;
  deleted_at: Date | null;
  // Player profile fields
  date_of_birth: string | null;
  nationality: string | null;
  preferred_language: string | null;
  skill_level: string | null;
  preferred_position: string | null;
  dominant_foot: string | null;
  preferred_days: string[];
};

export type PlayerStatsRow = {
  matches_played: string;
  wins: string;
  losses: string;
  draws: string;
  goals_scored: string;
  assists: string;
  mvp_awards: string;
};

/** Returned by banUser / unbanUser. */
export type BanUserRow = {
  id: string;
  banned_at: Date | null;
  banned_until: Date | null;
  ban_reason: string | null;
};

/** A cancelled booking + the email of the affected user, used to drive refunds & emails. */
export type BanCancelledBookingRow = {
  booking_id: string;
  match_id: string;
  user_email: string;
  paid_amount: string;
  was_confirmed: boolean;
};

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  async findByIdInTenant(
    tenantId: string,
    userId: string,
  ): Promise<UserRow | null> {
    const { rows } = await this.query<UserRow>(
      this.pool,
      `SELECT id, tenant_id, name, email, role, is_active, deleted_at, created_at, updated_at
       FROM users
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Tenant-scoped user detail for admin/staff. Excludes password_hash and other secrets.
   * Soft-deleted users → null (caller returns 404).
   */
  async findTenantUserDetailById(
    tenantId: string,
    userId: string,
  ): Promise<TenantUserDetailRow | null> {
    const { rows } = await this.query<TenantUserDetailRow>(
      this.pool,
      `SELECT
         id,
         name,
         email,
         phone,
         photo_url,
         role::text AS role,
         is_active,
         is_fake,
         wallet_balance::text AS wallet_balance,
         banned_at,
         banned_until,
         ban_reason,
         created_at,
         updated_at
       FROM users
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Loads user by JWT subject + tenant (no deleted filter).
   * Caller must treat deleted_at or missing row as unauthorized for /users/me.
   */
  async findByIdForSelfProfile(
    tenantId: string,
    userId: string,
  ): Promise<UserSelfProfileRow | null> {
    const { rows } = await this.query<UserSelfProfileRow>(
      this.pool,
      `SELECT
         id, name, email, phone, photo_url, role, wallet_balance, created_at, deleted_at,
         date_of_birth::text AS date_of_birth,
         nationality,
         preferred_language,
         skill_level::text AS skill_level,
         preferred_position::text AS preferred_position,
         dominant_foot::text AS dominant_foot,
         preferred_days::text[] AS preferred_days
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Another active user in the tenant with the same normalized email (case-insensitive), excluding `excludeUserId`.
   */
  async findOtherUserIdByNormalizedEmail(
    tenantId: string,
    normalizedEmail: string,
    excludeUserId: string,
  ): Promise<string | null> {
    const { rows } = await this.query<{ id: string }>(
      this.pool,
      `SELECT id
       FROM users
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND id <> $2
         AND LOWER(TRIM(email)) = $3
       LIMIT 1`,
      [tenantId, excludeUserId, normalizedEmail],
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Confirmed bookings for matches that are still in the future (blocks self-delete).
   */
  async hasUpcomingConfirmedBookings(
    executor: DbExecutor,
    userId: string,
  ): Promise<boolean> {
    const { rows } = await this.query<{ exists: boolean }>(
      executor,
      `SELECT EXISTS (
        SELECT 1
        FROM bookings b
        INNER JOIN matches m ON m.id = b.match_id
        WHERE b.user_id = $1
          AND b.status = 'confirmed'
          AND m.scheduled_at > NOW()
      ) AS exists`,
      [userId],
    );
    return rows[0]?.exists ?? false;
  }

  /**
   * Soft-delete active user in tenant. Returns false if no matching active row.
   */
  async softDeleteAccount(
    executor: DbExecutor,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const { rows } = await this.query<{ id: string }>(
      executor,
      `UPDATE users
       SET deleted_at = NOW(), is_active = false, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * Partial update for current user profile. Omits columns not in `fields`.
   * When `fields` is empty, reloads profile without updating `updated_at`.
   */
  async patchSelfProfile(
    tenantId: string,
    userId: string,
    fields: {
      name?: string;
      phone?: number | bigint;
      photo_url?: string;
      email?: string;
      date_of_birth?: string | null;
      nationality?: string | null;
      preferred_language?: string | null;
      skill_level?: string | null;
      preferred_position?: string | null;
      dominant_foot?: string | null;
      preferred_days?: string[];
    },
  ): Promise<UserSelfProfileRow | null> {
    const fragments: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (fields.name !== undefined) {
      fragments.push(`name = $${i++}`);
      values.push(fields.name);
    }
    if (fields.phone !== undefined) {
      fragments.push(`phone = $${i++}`);
      values.push(fields.phone);
    }
    if (fields.photo_url !== undefined) {
      fragments.push(`photo_url = $${i++}`);
      values.push(fields.photo_url);
    }
    if (fields.email !== undefined) {
      fragments.push(`email = $${i++}`);
      values.push(fields.email);
    }
    if (fields.date_of_birth !== undefined) {
      fragments.push(`date_of_birth = $${i++}`);
      values.push(fields.date_of_birth);
    }
    if (fields.nationality !== undefined) {
      fragments.push(`nationality = $${i++}`);
      values.push(fields.nationality);
    }
    if (fields.preferred_language !== undefined) {
      fragments.push(`preferred_language = $${i++}`);
      values.push(fields.preferred_language);
    }
    if (fields.skill_level !== undefined) {
      fragments.push(`skill_level = $${i++}::skill_level`);
      values.push(fields.skill_level);
    }
    if (fields.preferred_position !== undefined) {
      fragments.push(`preferred_position = $${i++}::player_position`);
      values.push(fields.preferred_position);
    }
    if (fields.dominant_foot !== undefined) {
      fragments.push(`dominant_foot = $${i++}::dominant_foot`);
      values.push(fields.dominant_foot);
    }
    if (fields.preferred_days !== undefined) {
      fragments.push(`preferred_days = $${i++}::day_of_week[]`);
      values.push(fields.preferred_days);
    }

    if (fragments.length === 0) {
      return this.findByIdForSelfProfile(tenantId, userId);
    }

    fragments.push(`updated_at = NOW()`);
    const idParam = i++;
    const tenantParam = i;
    values.push(userId, tenantId);

    const { rows } = await this.query<UserSelfProfileRow>(
      this.pool,
      `UPDATE users
       SET ${fragments.join(', ')}
       WHERE id = $${idParam} AND tenant_id = $${tenantParam} AND deleted_at IS NULL
       RETURNING
         id, name, email, phone, photo_url, role, wallet_balance, created_at, deleted_at,
         date_of_birth::text AS date_of_birth,
         nationality,
         preferred_language,
         skill_level::text AS skill_level,
         preferred_position::text AS preferred_position,
         dominant_foot::text AS dominant_foot,
         preferred_days::text[] AS preferred_days`,
      values,
    );
    return rows[0] ?? null;
  }

  async updateRole(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<UserRow | null> {
    const { rows } = await this.query<UserRow>(
      this.pool,
      `UPDATE users
       SET role = $1::user_role, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       RETURNING id, tenant_id, name, email, role, is_active, deleted_at, created_at, updated_at`,
      [role, userId, tenantId],
    );
    return rows[0] ?? null;
  }

  async insertRegisteredUser(params: {
    tenantId: string;
    name: string;
    email: string;
    passwordHash: string;
    phone: bigint;
    dateOfBirth?: string;
    nationality?: string;
    preferredLanguage?: string;
    skillLevel?: string;
    preferredPosition?: string;
    dominantFoot?: string;
    photoUrl?: string;
    preferredDays?: string[];
  }): Promise<RegisteredUserRow> {
    const { rows } = await this.query<RegisteredUserRow>(
      this.pool,
      `INSERT INTO users (
         tenant_id, name, email, password_hash, phone, role,
         email_verified_at, date_of_birth, nationality, preferred_language,
         skill_level, preferred_position, dominant_foot, photo_url, preferred_days
       )
       VALUES ($1, $2, $3, $4, $5, 'player', NULL, $6, $7, $8, $9, $10, $11, $12, $13::day_of_week[])
       RETURNING id, name, email, role, created_at`,
      [
        params.tenantId,
        params.name,
        params.email,
        params.passwordHash,
        params.phone,
        params.dateOfBirth ?? null,
        params.nationality ?? null,
        params.preferredLanguage ?? null,
        params.skillLevel ?? null,
        params.preferredPosition ?? null,
        params.dominantFoot ?? null,
        params.photoUrl ?? '',
        params.preferredDays ?? [],
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Insert returned no row');
    }
    return row;
  }

  /**
   * Inserts a super_admin user within an existing transaction.
   * Used by TenantsService.createTenant to atomically create the initial super_admin.
   */
  async insertSuperAdminWithinTransaction(
    executor: DbExecutor,
    params: {
      tenantId: string;
      name: string;
      email: string;
      passwordHash: string;
    },
  ): Promise<RegisteredUserRow> {
    const { rows } = await this.query<RegisteredUserRow>(
      executor,
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'super_admin')
       RETURNING id, name, email, role, created_at`,
      [params.tenantId, params.name, params.email, params.passwordHash],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Insert super_admin returned no row');
    }
    return row;
  }

  async findForLogin(
    tenantId: string,
    email: string,
  ): Promise<UserForLoginRow | null> {
    const { rows } = await this.query<UserForLoginRow>(
      this.pool,
      `SELECT id, name, email, role, password_hash, photo_url, deleted_at, is_active, is_fake, banned_at, banned_until
             , email_verified_at
       FROM users
       WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    return rows[0] ?? null;
  }

  /**
   * Looks up a user by phone (stored as BIGINT — digits only, no leading +).
   */
  async findForLoginByPhone(
    tenantId: string,
    phoneDigits: bigint,
  ): Promise<UserForLoginRow | null> {
    const { rows } = await this.query<UserForLoginRow>(
      this.pool,
      `SELECT id, name, email, role, password_hash, photo_url, deleted_at, is_active, is_fake, banned_at, banned_until
             , email_verified_at
       FROM users
       WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, phoneDigits],
    );
    return rows[0] ?? null;
  }

  async findActiveByEmailForTenant(
    tenantId: string,
    email: string,
  ): Promise<ForgotPasswordUserRow | null> {
    const { rows } = await this.query<ForgotPasswordUserRow>(
      this.pool,
      `SELECT id, name, email FROM users
       WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL AND is_active = true AND is_fake = false`,
      [tenantId, email],
    );
    return rows[0] ?? null;
  }

  async findActiveUnverifiedByEmailForTenant(
    tenantId: string,
    email: string,
  ): Promise<UnverifiedUserRow | null> {
    const { rows } = await this.query<UnverifiedUserRow>(
      this.pool,
      `SELECT id, name, email
       FROM users
       WHERE tenant_id = $1
         AND email = $2
         AND deleted_at IS NULL
         AND is_active = true
         AND is_fake = false
         AND email_verified_at IS NULL`,
      [tenantId, email],
    );
    return rows[0] ?? null;
  }

  async updatePasswordHash(
    db: DbExecutor,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.query(
      db,
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId],
    );
  }

  async markEmailVerified(db: DbExecutor, userId: string): Promise<void> {
    await this.query(
      db,
      'UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId],
    );
  }

  async findPasswordHashById(
    userId: string,
  ): Promise<{ password_hash: string } | null> {
    const { rows } = await this.query<{ password_hash: string }>(
      this.pool,
      `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [userId],
    );
    return rows[0] ?? null;
  }

  /** Row for GET /users (tenant staff list). */
  async countTenantUsers(params: {
    tenantId: string;
    role?: string;
    isActive?: boolean;
    isBanned?: boolean;
    isFake?: boolean;
    includeDeleted: boolean;
    search?: string;
  }): Promise<number> {
    const { whereSql, values } =
      UsersRepository.buildTenantUserListWhere(params);
    const { rows } = await this.query<{ c: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS c FROM users WHERE ${whereSql}`,
      values,
    );
    return parseInt(rows[0]?.c ?? '0', 10);
  }

  async findTenantUsers(params: {
    tenantId: string;
    role?: string;
    isActive?: boolean;
    isBanned?: boolean;
    isFake?: boolean;
    includeDeleted: boolean;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<TenantUserListRow[]> {
    const { whereSql, values } =
      UsersRepository.buildTenantUserListWhere(params);
    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const { rows } = await this.query<TenantUserListRow>(
      this.pool,
      `SELECT
         id,
         name,
         email,
         role::text AS role,
         is_active,
         is_fake,
         wallet_balance::text AS wallet_balance,
         banned_at,
         banned_until,
         created_at
       FROM users
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...values, params.limit, params.offset],
    );
    return rows;
  }

  /**
   * Aggregates player stats from player_match_stats + match_results for a user within a tenant.
   * Draws are matches where a result was submitted but winning_side IS NULL.
   */
  async computePlayerStats(
    userId: string,
    tenantId: string,
  ): Promise<PlayerStatsRow> {
    const { rows } = await this.query<PlayerStatsRow>(
      this.pool,
      `SELECT
         COUNT(pms.id)::text                                                  AS matches_played,
         COUNT(*) FILTER (WHERE mr.winning_side::text = pms.team_side::text)::text AS wins,
         COUNT(*) FILTER (
           WHERE mr.winning_side IS NOT NULL
             AND mr.winning_side::text <> pms.team_side::text
         )::text                                                              AS losses,
         COUNT(*) FILTER (
           WHERE mr.match_id IS NOT NULL AND mr.winning_side IS NULL
         )::text                                                              AS draws,
         COALESCE(SUM(pms.goals), 0)::text                                   AS goals_scored,
         COALESCE(SUM(pms.assists), 0)::text                                 AS assists,
         COUNT(*) FILTER (WHERE pms.is_mvp = true)::text                     AS mvp_awards
       FROM player_match_stats pms
       INNER JOIN matches m ON m.id = pms.match_id
       INNER JOIN venues v  ON v.id = m.venue_id
       LEFT JOIN  match_results mr ON mr.match_id = pms.match_id
       WHERE pms.user_id = $1
         AND v.tenant_id = $2`,
      [userId, tenantId],
    );
    return (
      rows[0] ?? {
        matches_played: '0',
        wins: '0',
        losses: '0',
        draws: '0',
        goals_scored: '0',
        assists: '0',
        mvp_awards: '0',
      }
    );
  }

  private static buildTenantUserListWhere(params: {
    tenantId: string;
    role?: string;
    isActive?: boolean;
    isBanned?: boolean;
    isFake?: boolean;
    includeDeleted: boolean;
    search?: string;
  }): { whereSql: string; values: unknown[] } {
    const values: unknown[] = [];
    const parts: string[] = [];
    let n = 1;

    parts.push(`tenant_id = $${n++}`);
    values.push(params.tenantId);
    parts.push(`role <> 'platform_admin'::user_role`);
    if (!params.includeDeleted) {
      parts.push('deleted_at IS NULL');
    }
    if (params.role !== undefined) {
      parts.push(`role = $${n++}::user_role`);
      values.push(params.role);
    }
    if (params.isActive !== undefined) {
      parts.push(`is_active = $${n++}`);
      values.push(params.isActive);
    }
    if (params.isFake !== undefined) {
      parts.push(`is_fake = $${n++}`);
      values.push(params.isFake);
    }
    if (params.isBanned === true) {
      parts.push(
        `(banned_at IS NOT NULL AND (banned_until IS NULL OR banned_until > NOW()))`,
      );
    } else if (params.isBanned === false) {
      parts.push(
        `(banned_at IS NULL OR (banned_until IS NOT NULL AND banned_until <= NOW()))`,
      );
    }
    if (params.search !== undefined && params.search.trim().length > 0) {
      const pattern = `%${params.search.trim()}%`;
      parts.push(`(name ILIKE $${n} OR email ILIKE $${n})`);
      values.push(pattern);
      n++;
    }

    return { whereSql: parts.join(' AND '), values };
  }

  /**
   * Sets ban fields atomically. Returns null if user not found in tenant or is soft-deleted.
   */
  async banUser(
    executor: DbExecutor,
    tenantId: string,
    userId: string,
    bannedUntil: Date | null,
    banReason: string | null,
  ): Promise<BanUserRow | null> {
    const { rows } = await this.query<BanUserRow>(
      executor,
      `UPDATE users
       SET banned_at = NOW(), banned_until = $3, ban_reason = $4, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id, banned_at, banned_until, ban_reason`,
      [userId, tenantId, bannedUntil, banReason],
    );
    return rows[0] ?? null;
  }

  /**
   * Clears ban fields. Returns null if user not found in tenant or is soft-deleted.
   */
  async unbanUser(
    tenantId: string,
    userId: string,
  ): Promise<BanUserRow | null> {
    const { rows } = await this.query<BanUserRow>(
      this.pool,
      `UPDATE users
       SET banned_at = NULL, banned_until = NULL, ban_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id, banned_at, banned_until, ban_reason`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Cancels all upcoming confirmed + pending bookings for a user and refunds paid amounts.
   * Returns one row per cancelled booking. Caller must run waitlist promotion for confirmed ones.
   * Must run within a transaction that also sets banned_at.
   */
  async bulkCancelAndRefundBookingsForBan(
    executor: DbExecutor,
    userId: string,
    tenantId: string,
  ): Promise<BanCancelledBookingRow[]> {
    const { rows } = await this.query<BanCancelledBookingRow>(
      executor,
      `WITH target_bookings AS (
         SELECT b.id AS booking_id,
                b.match_id,
                b.paid_amount,
                b.status,
                u.email AS user_email
         FROM bookings b
         INNER JOIN matches m  ON m.id  = b.match_id
         INNER JOIN venues  v  ON v.id  = m.venue_id
         INNER JOIN users   u  ON u.id  = b.user_id
         WHERE b.user_id   = $1
           AND v.tenant_id = $2
           AND b.status IN ('confirmed', 'pending')
           AND m.scheduled_at > NOW()
         FOR UPDATE OF b
       ),
       cancelled AS (
         UPDATE bookings
         SET    status       = 'cancelled'::booking_status,
                cancelled_at = NOW(),
                refunded_at  = CASE WHEN paid_amount > 0 THEN NOW() ELSE refunded_at END,
                updated_at   = NOW()
         WHERE  id IN (SELECT booking_id FROM target_bookings)
         RETURNING id
       ),
       refunded AS (
         UPDATE users
         SET    wallet_balance = wallet_balance + tb.total_refund,
                updated_at     = NOW()
         FROM (
           SELECT SUM(paid_amount) AS total_refund
           FROM target_bookings
           WHERE paid_amount > 0
         ) tb
         WHERE  users.id = $1
           AND  tb.total_refund > 0
       ),
       tx_insert AS (
         INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
         SELECT $1, tb.paid_amount, 'refund'::wallet_tx_type, tb.booking_id
         FROM   target_bookings tb
         WHERE  tb.paid_amount > 0
       )
       SELECT
         booking_id,
         match_id,
         user_email,
         paid_amount::text AS paid_amount,
         (status = 'confirmed') AS was_confirmed
       FROM target_bookings`,
      [userId, tenantId],
    );
    return rows;
  }

  /**
   * Inserts a single fake player.
   * - role='player', is_fake=true, password_hash=NULL (login is blocked at the auth layer).
   * - email is generated by the caller as `fake+<uuid>@fake.local` to satisfy the
   *   per-tenant uniqueness constraint without colliding with real users.
   */
  async insertFakePlayer(params: {
    tenantId: string;
    name: string;
    email: string;
    photoUrl: string | null;
    skillLevel: string | null;
    preferredPosition: string | null;
    dominantFoot: string | null;
    preferredDays: string[];
  }): Promise<FakePlayerRow> {
    const { rows } = await this.query<FakePlayerRow>(
      this.pool,
      `INSERT INTO users (
         tenant_id, name, email, password_hash, phone, role,
         email_verified_at, photo_url, is_fake,
         skill_level, preferred_position, dominant_foot, preferred_days
       )
       VALUES (
         $1, $2, $3, NULL, 0, 'player',
         NULL, $4, true,
         $5::skill_level, $6::player_position, $7::dominant_foot, $8::day_of_week[]
       )
       RETURNING
         id,
         name,
         email,
         photo_url,
         skill_level::text AS skill_level,
         preferred_position::text AS preferred_position,
         dominant_foot::text AS dominant_foot,
         preferred_days::text[] AS preferred_days,
         created_at`,
      [
        params.tenantId,
        params.name,
        params.email,
        params.photoUrl,
        params.skillLevel,
        params.preferredPosition,
        params.dominantFoot,
        params.preferredDays,
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('insertFakePlayer: expected one row');
    }
    return row;
  }

  /**
   * Bulk inserts fake players from an array of pre-generated profile rows.
   * One round trip via UNNEST. Caller is responsible for cap (e.g. <= 200 per call).
   */
  async bulkInsertFakePlayers(
    tenantId: string,
    profiles: Array<{
      name: string;
      email: string;
      photoUrl: string | null;
      skillLevel: string | null;
      preferredPosition: string | null;
      dominantFoot: string | null;
      preferredDays: string[];
    }>,
  ): Promise<FakePlayerRow[]> {
    if (profiles.length === 0) {
      return [];
    }
    const { rows } = await this.query<FakePlayerRow>(
      this.pool,
      `INSERT INTO users (
         tenant_id, name, email, password_hash, phone, role,
         email_verified_at, photo_url, is_fake,
         skill_level, preferred_position, dominant_foot, preferred_days
       )
       SELECT
         $1::uuid,
         p.name,
         p.email,
         NULL,
         0,
         'player',
         NULL,
         p.photo_url,
         true,
         NULLIF(p.skill_level, '')::skill_level,
         NULLIF(p.preferred_position, '')::player_position,
         NULLIF(p.dominant_foot, '')::dominant_foot,
         p.preferred_days::day_of_week[]
       FROM UNNEST(
         $2::text[], $3::text[], $4::text[],
         $5::text[], $6::text[], $7::text[], $8::text[]
       ) AS p(name, email, photo_url, skill_level, preferred_position, dominant_foot, preferred_days)
       RETURNING
         id,
         name,
         email,
         photo_url,
         skill_level::text AS skill_level,
         preferred_position::text AS preferred_position,
         dominant_foot::text AS dominant_foot,
         preferred_days::text[] AS preferred_days,
         created_at`,
      [
        tenantId,
        profiles.map((p) => p.name),
        profiles.map((p) => p.email),
        profiles.map((p) => p.photoUrl ?? ''),
        profiles.map((p) => p.skillLevel ?? ''),
        profiles.map((p) => p.preferredPosition ?? ''),
        profiles.map((p) => p.dominantFoot ?? ''),
        profiles.map((p) => `{${p.preferredDays.join(',')}}`),
      ],
    );
    return rows;
  }

  /**
   * Hard-deletes a fake user (and cascades any bookings/wallet rows via FK ON DELETE CASCADE).
   * Guarded by `is_fake = true` so a stray id can never destroy a real user.
   * Returns true when a fake user was deleted; false when not found / not fake.
   */
  async hardDeleteFakeUser(tenantId: string, userId: string): Promise<boolean> {
    const { rows } = await this.query<{ id: string }>(
      this.pool,
      `DELETE FROM users
       WHERE id = $1 AND tenant_id = $2 AND is_fake = true
       RETURNING id`,
      [userId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * Picks up to `limit` random fake users in this tenant who are NOT already booked
   * (active = pending or confirmed) on the target match. Used by match auto-fill.
   */
  async findRandomFakePlayersAvailableForMatch(
    tenantId: string,
    matchId: string,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    if (limit <= 0) {
      return [];
    }
    const { rows } = await this.query<{ id: string }>(
      this.pool,
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
      [tenantId, matchId, limit],
    );
    return rows;
  }
}
