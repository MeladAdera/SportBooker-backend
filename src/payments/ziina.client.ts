import { Injectable, Logger } from '@nestjs/common';

const ZIINA_API_BASE = 'https://api-v2.ziina.com/api';

export type ZiinaPaymentIntentStatus =
  | 'requires_payment_instrument'
  | 'requires_user_action'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface ZiinaPaymentIntent {
  id: string;
  account_id: string;
  amount: number;
  tip_amount: number;
  fee_amount: number | null;
  currency_code: string;
  created_at: string;
  status: ZiinaPaymentIntentStatus;
  operation_id: string;
  message: string | null;
  redirect_url: string | null;
  embedded_url: string | null;
  success_url: string | null;
  cancel_url: string | null;
}

export interface CreatePaymentIntentParams {
  /** Amount in base currency units (fils). e.g. AED 100 = 10000. */
  amount: number;
  currency_code: string;
  message?: string;
  success_url: string;
  cancel_url: string;
  failure_url: string;
  /** Use true in development/test mode. */
  test?: boolean;
}

export interface RegisterWebhookParams {
  url: string;
  /** HMAC secret — Ziina will sign requests with this. */
  secret: string;
}

@Injectable()
export class ZiinaClient {
  private readonly logger = new Logger(ZiinaClient.name);

  async createPaymentIntent(
    accessToken: string,
    params: CreatePaymentIntentParams,
  ): Promise<ZiinaPaymentIntent> {
    const res = await fetch(`${ZIINA_API_BASE}/payment_intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Ziina createPaymentIntent failed: ${res.status} ${body}`,
      );
      throw new Error(`Ziina API error: ${res.status}`);
    }

    return res.json() as Promise<ZiinaPaymentIntent>;
  }

  async registerWebhook(
    accessToken: string,
    params: RegisterWebhookParams,
  ): Promise<void> {
    const res = await fetch(`${ZIINA_API_BASE}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Ziina registerWebhook failed: ${res.status} ${body}`);
      throw new Error(`Ziina webhook registration error: ${res.status}`);
    }
  }
}
