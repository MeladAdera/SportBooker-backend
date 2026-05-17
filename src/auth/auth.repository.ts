import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseRepository, type DbExecutor } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';
import type { Pool } from 'pg';

export type RefreshTokenWithUserRow = {
  user_id: string;
  token_hash: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  photo_url: string | null;
};

export type PasswordResetTokenRow = {
  user_id: string;
  token_hash: string;
};

export type EmailVerificationTokenRow = {
  user_id: string;
  token_hash: string;
};

@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  /**
   * Public wrapper so services can run multi-step auth flows on one connection without exposing `Pool`.
   */
  runInTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  /** Create refresh token using the shared pool (e.g. login). */
  async createRefreshToken(userId: string, tokenHash: string): Promise<string> {
    return this.insertRefreshToken(this.pool, userId, tokenHash);
  }

  async insertRefreshToken(
    db: DbExecutor,
    userId: string,
    tokenHash: string,
  ): Promise<string> {
    const { rows } = await this.query<{ id: string }>(
      db,
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [userId, tokenHash],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error('Failed to create refresh token');
    }
    return id;
  }

  /**
   * Locks the refresh token row for the duration of the transaction (rotation).
   * Returns null if the token is expired, the user is soft-deleted, inactive, or actively banned.
   */
  async findRefreshTokenWithUserForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<RefreshTokenWithUserRow | null> {
    const { rows } = await this.query<RefreshTokenWithUserRow>(
      client,
      `SELECT rt.user_id, rt.token_hash, u.tenant_id, u.name, u.email, u.role, u.photo_url
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.id = $1
         AND rt.expires_at > NOW()
         AND u.deleted_at IS NULL
         AND u.is_active = true
         AND (u.banned_at IS NULL OR (u.banned_until IS NOT NULL AND u.banned_until <= NOW()))
       FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async deleteRefreshTokenById(client: PoolClient, id: string): Promise<void> {
    await this.query(client, 'DELETE FROM refresh_tokens WHERE id = $1', [id]);
  }

  async deleteRefreshTokensByUserId(
    db: DbExecutor,
    userId: string,
  ): Promise<void> {
    await this.query(db, 'DELETE FROM refresh_tokens WHERE user_id = $1', [
      userId,
    ]);
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.deleteRefreshTokensByUserId(this.pool, userId);
  }

  async deletePasswordResetTokensByUserId(
    db: DbExecutor,
    userId: string,
  ): Promise<void> {
    await this.query(
      db,
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId],
    );
  }

  async deletePasswordResetTokensForUser(userId: string): Promise<void> {
    await this.deletePasswordResetTokensByUserId(this.pool, userId);
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
  ): Promise<string> {
    return this.insertPasswordResetToken(this.pool, userId, tokenHash);
  }

  async insertPasswordResetToken(
    db: DbExecutor,
    userId: string,
    tokenHash: string,
  ): Promise<string> {
    const { rows } = await this.query<{ id: string }>(
      db,
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 HOUR')
       RETURNING id`,
      [userId, tokenHash],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error('Failed to create password reset token');
    }
    return id;
  }

  async findPasswordResetTokenForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<PasswordResetTokenRow | null> {
    const { rows } = await this.query<PasswordResetTokenRow>(
      client,
      `SELECT user_id, token_hash
       FROM password_reset_tokens
       WHERE id = $1 AND expires_at > NOW() AND used_at IS NULL
       FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async markPasswordResetTokenUsed(
    client: PoolClient,
    id: string,
  ): Promise<void> {
    await this.query(
      client,
      'UPDATE password_reset_tokens SET used_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async deleteEmailVerificationTokensByUserId(
    db: DbExecutor,
    userId: string,
  ): Promise<void> {
    await this.query(
      db,
      'DELETE FROM email_verification_tokens WHERE user_id = $1',
      [userId],
    );
  }

  async deleteEmailVerificationTokensForUser(userId: string): Promise<void> {
    await this.deleteEmailVerificationTokensByUserId(this.pool, userId);
  }

  async createEmailVerificationToken(
    userId: string,
    tokenHash: string,
  ): Promise<string> {
    return this.insertEmailVerificationToken(this.pool, userId, tokenHash);
  }

  async insertEmailVerificationToken(
    db: DbExecutor,
    userId: string,
    tokenHash: string,
  ): Promise<string> {
    const { rows } = await this.query<{ id: string }>(
      db,
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 HOURS')
       RETURNING id`,
      [userId, tokenHash],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error('Failed to create email verification token');
    }
    return id;
  }

  async findEmailVerificationTokenForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<EmailVerificationTokenRow | null> {
    const { rows } = await this.query<EmailVerificationTokenRow>(
      client,
      `SELECT user_id, token_hash
       FROM email_verification_tokens
       WHERE id = $1 AND expires_at > NOW() AND used_at IS NULL
       FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async markEmailVerificationTokenUsed(
    client: PoolClient,
    id: string,
  ): Promise<void> {
    await this.query(
      client,
      'UPDATE email_verification_tokens SET used_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id],
    );
  }
}
