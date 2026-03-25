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
