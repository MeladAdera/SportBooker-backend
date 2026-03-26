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

  async findForLogin(
    tenantId: string,
    email: string,
  ): Promise<UserForLoginRow | null> {
    const { rows } = await this.query<UserForLoginRow>(
      this.pool,
      `SELECT id, email, role, password_hash, deleted_at, is_active
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
}
