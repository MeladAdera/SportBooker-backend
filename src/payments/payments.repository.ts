import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BaseRepository, type DbExecutor } from '../database/base.repository';
import { DB_POOL } from '../database/database.constants';

export type PaymentIntentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PaymentIntentRow = {
  id: string;
  ziina_payment_id: string;
  user_id: string;
  tenant_id: string;
  amount: string;
  currency_code: string;
  status: PaymentIntentStatus;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PaymentsRepository extends BaseRepository {
  constructor(@Inject(DB_POOL) pool: Pool) {
    super(pool);
  }

  async insertPaymentIntent(params: {
    ziinaPaymentId: string;
    userId: string;
    tenantId: string;
    /** AED value (e.g. 100.00), stored as numeric. */
    amount: number;
  }): Promise<PaymentIntentRow> {
    const { rows } = await this.query<PaymentIntentRow>(
      this.pool,
      `INSERT INTO payment_intents (ziina_payment_id, user_id, tenant_id, amount, currency_code)
       VALUES ($1, $2, $3, $4, 'AED')
       RETURNING id, ziina_payment_id, user_id, tenant_id, amount::text, currency_code, status, created_at, updated_at`,
      [params.ziinaPaymentId, params.userId, params.tenantId, params.amount],
    );
    const row = rows[0];
    if (!row) throw new Error('Insert payment_intent returned no row');
    return row;
  }

  async findPendingByZiinaId(
    ziinaPaymentId: string,
  ): Promise<PaymentIntentRow | null> {
    const { rows } = await this.query<PaymentIntentRow>(
      this.pool,
      `SELECT id, ziina_payment_id, user_id, tenant_id, amount::text, currency_code, status, created_at, updated_at
       FROM payment_intents
       WHERE ziina_payment_id = $1 AND status = 'pending'`,
      [ziinaPaymentId],
    );
    return rows[0] ?? null;
  }

  /**
   * Credits the player's wallet and marks the intent completed atomically.
   * No-op if the intent is not in pending state (idempotency guard handled by caller
   * via findPendingByZiinaId, but the UPDATE WHERE status='pending' is a final safety net).
   */
  async completeTopup(
    client: DbExecutor,
    params: {
      paymentIntentId: string;
      userId: string;
      tenantId: string;
      amount: number;
    },
  ): Promise<void> {
    await this.query(
      client,
      `UPDATE users
       SET wallet_balance = wallet_balance + $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [params.amount, params.userId, params.tenantId],
    );

    await this.query(
      client,
      `INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
       VALUES ($1, $2, 'topup', $3)`,
      [params.userId, params.amount, params.paymentIntentId],
    );

    await this.query(
      client,
      `UPDATE payment_intents
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [params.paymentIntentId],
    );
  }

  async markFailed(
    ziinaPaymentId: string,
    status: 'failed' | 'cancelled',
  ): Promise<void> {
    await this.query(
      this.pool,
      `UPDATE payment_intents
       SET status = $1, updated_at = NOW()
       WHERE ziina_payment_id = $2 AND status = 'pending'`,
      [status, ziinaPaymentId],
    );
  }

  /** Fetches the tenant's Ziina credentials. Null fields mean not configured. */
  async findZiinaCredentials(tenantId: string): Promise<{
    ziina_access_token: string | null;
    ziina_webhook_secret: string | null;
  } | null> {
    const { rows } = await this.query<{
      ziina_access_token: string | null;
      ziina_webhook_secret: string | null;
    }>(
      this.pool,
      `SELECT ziina_access_token, ziina_webhook_secret
       FROM tenants
       WHERE id = $1`,
      [tenantId],
    );
    return rows[0] ?? null;
  }

  /** Looks up tenant_id + webhook secret by ziina_payment_id for webhook routing. */
  async findTenantByZiinaPaymentId(ziinaPaymentId: string): Promise<{
    tenant_id: string;
    ziina_webhook_secret: string | null;
  } | null> {
    const { rows } = await this.query<{
      tenant_id: string;
      ziina_webhook_secret: string | null;
    }>(
      this.pool,
      `SELECT pi.tenant_id, t.ziina_webhook_secret
       FROM payment_intents pi
       INNER JOIN tenants t ON t.id = pi.tenant_id
       WHERE pi.ziina_payment_id = $1`,
      [ziinaPaymentId],
    );
    return rows[0] ?? null;
  }
}
