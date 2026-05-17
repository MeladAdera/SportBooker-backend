import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type WalletTransactionRow = {
  id: string;
  type: string;
  amount: string;
  reference_id: string | null;
  created_at: Date;
};

@Injectable()
export class WalletRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  /**
   * Current wallet balance from users row (not derived from transactions).
   */
  async findWalletBalanceForUser(
    tenantId: string,
    userId: string,
  ): Promise<string | null> {
    const { rows } = await this.query<{ wallet_balance: string }>(
      this.pool,
      `SELECT u.wallet_balance::text AS wallet_balance
       FROM users u
       WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL`,
      [userId, tenantId],
    );
    return rows[0]?.wallet_balance ?? null;
  }

  async countWalletTransactionsForUser(
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const { rows } = await this.query<{ c: string }>(
      this.pool,
      `SELECT COUNT(*)::text AS c
       FROM wallet_transactions wt
       INNER JOIN users u ON u.id = wt.user_id
       WHERE wt.user_id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    );
    return parseInt(rows[0]?.c ?? '0', 10);
  }

  async findWalletTransactionsForUser(params: {
    tenantId: string;
    userId: string;
    limit: number;
    offset: number;
  }): Promise<WalletTransactionRow[]> {
    const { tenantId, userId, limit, offset } = params;
    const { rows } = await this.query<WalletTransactionRow>(
      this.pool,
      `SELECT
         wt.id,
         wt.type::text AS type,
         wt.amount::text AS amount,
         wt.reference_id,
         wt.created_at
       FROM wallet_transactions wt
       INNER JOIN users u ON u.id = wt.user_id
       WHERE wt.user_id = $1 AND u.tenant_id = $2
       ORDER BY wt.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, tenantId, limit, offset],
    );
    return rows;
  }
}
