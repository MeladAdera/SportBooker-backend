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
  password_hash: string;
  deleted_at: Date | null;
  is_active: boolean | null;
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
  email: string;
};

/** Row for GET /users (tenant staff list). */
export type TenantUserListRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  wallet_balance: string;
  created_at: Date;
};

/** Row for GET /users/:userId (tenant staff detail). */
export type TenantUserDetailRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  role: string;
  is_active: boolean;
  /** pg `numeric` — use Number() when mapping to API */
  wallet_balance: string;
  created_at: Date;
  updated_at: Date;
};

/** Row for GET /users/me; includes deleted_at to distinguish soft-deleted users. */
export type UserSelfProfileRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  role: string;
  /** pg `numeric` — use Number() when mapping to API */
  wallet_balance: string;
  created_at: Date;
  deleted_at: Date | null;
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
         wallet_balance::text AS wallet_balance,
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
      `SELECT id, name, email, phone, photo_url, role, wallet_balance, created_at, deleted_at
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
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
    fields: { name?: string; phone?: string; photo_url?: string },
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
       RETURNING id, name, email, phone, photo_url, role, wallet_balance, created_at, deleted_at`,
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
    phone: string | null;
  }): Promise<RegisteredUserRow> {
    const { rows } = await this.query<RegisteredUserRow>(
      this.pool,
      `INSERT INTO users (tenant_id, name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'player')
       RETURNING id, name, email, role, created_at`,
      [
        params.tenantId,
        params.name,
        params.email,
        params.passwordHash,
        params.phone,
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
      `SELECT id, name, email, role, password_hash, deleted_at, is_active
       FROM users
       WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    return rows[0] ?? null;
  }

  async findActiveByEmailForTenant(
    tenantId: string,
    email: string,
  ): Promise<ForgotPasswordUserRow | null> {
    const { rows } = await this.query<ForgotPasswordUserRow>(
      this.pool,
      `SELECT id, email FROM users
       WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL AND is_active = true`,
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
    includeDeleted: boolean;
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
    includeDeleted: boolean;
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
         wallet_balance::text AS wallet_balance,
         created_at
       FROM users
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...values, params.limit, params.offset],
    );
    return rows;
  }

  private static buildTenantUserListWhere(params: {
    tenantId: string;
    role?: string;
    isActive?: boolean;
    includeDeleted: boolean;
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

    return { whereSql: parts.join(' AND '), values };
  }
}
