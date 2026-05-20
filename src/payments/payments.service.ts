import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentsRepository } from './payments.repository';
import { ZiinaClient } from './ziina.client';
import { CryptoService } from '../common/crypto/crypto.service';
import type { TopupResponseDto } from './dto/topup-response.dto';
import type { Tenant } from '../common/tenant.types';
import { buildTenantPublicOrigin } from './tenant-public-url';
import {
  resolveApiPublicOrigin,
  resolveWebAppPublicOrigin,
} from '../config/public-origins';

/** Ziina IPs that are allowed to deliver webhooks. */
const ZIINA_WEBHOOK_IPS = new Set([
  '3.29.184.186',
  '3.29.190.95',
  '20.233.47.127',
  '13.202.161.181',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly ziinaClient: ZiinaClient,
    private readonly config: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  async createTopup(params: {
    tenant: Tenant;
    userId: string;
    amount: number;
  }): Promise<TopupResponseDto> {
    const { tenant, userId, amount } = params;

    // FREE MODE: Add credits directly without payment
    const record = await this.paymentsRepository.insertPaymentIntent({
      ziinaPaymentId: `free-topup-${Date.now()}`,
      userId,
      tenantId: tenant.id,
      amount,
    });

    // Auto-complete the topup immediately
    await this.paymentsRepository.withTransaction(async (client) => {
      await this.paymentsRepository.completeTopup(client, {
        paymentIntentId: record.id,
        userId,
        tenantId: tenant.id,
        amount,
      });
    });

    this.logger.log(
      `Free wallet top-up: user=${userId} amount=${amount}`,
    );

    return {
      redirectUrl: '', // No redirect needed
      paymentIntentId: record.id,
    };
  }

  async handleWebhook(params: {
    rawBody: Buffer;
    hmacSignature: string | undefined;
    clientIp: string;
    payload: ZiinaWebhookPayload;
  }): Promise<void> {
    const { rawBody, hmacSignature, clientIp, payload } = params;

    if (!ZIINA_WEBHOOK_IPS.has(clientIp)) {
      this.logger.warn(`Webhook rejected: unknown IP ${clientIp}`);
      return;
    }

    if (payload.event !== 'payment_intent.status.updated') {
      // Acknowledged but nothing to do
      return;
    }

    const ziinaPaymentId: string = payload.data?.id;
    if (!ziinaPaymentId) {
      this.logger.warn('Webhook payload missing payment intent id');
      return;
    }

    const tenantCreds =
      await this.paymentsRepository.findTenantByZiinaPaymentId(ziinaPaymentId);

    if (!tenantCreds) {
      // Unknown payment intent — could be a stale retry, log and move on
      this.logger.warn(
        `Unknown ziina_payment_id in webhook: ${ziinaPaymentId}`,
      );
      return;
    }

    if (!tenantCreds.ziina_webhook_secret) {
      this.logger.warn(
        `Webhook rejected for payment ${ziinaPaymentId}: tenant has no webhook secret configured`,
      );
      return;
    }

    if (
      !hmacSignature ||
      !this.verifyHmac(rawBody, hmacSignature, tenantCreds.ziina_webhook_secret)
    ) {
      this.logger.warn(
        `Webhook HMAC verification failed for payment ${ziinaPaymentId}`,
      );
      return;
    }

    const status: string = payload.data?.status;

    if (status === 'completed') {
      await this.processCompletedTopup(ziinaPaymentId);
    } else if (status === 'failed') {
      await this.paymentsRepository.markFailed(ziinaPaymentId, 'failed');
    } else if (status === 'canceled') {
      await this.paymentsRepository.markFailed(ziinaPaymentId, 'cancelled');
    }
  }

  private async processCompletedTopup(ziinaPaymentId: string): Promise<void> {
    const intent =
      await this.paymentsRepository.findPendingByZiinaId(ziinaPaymentId);
    if (!intent) {
      // Already processed or not found — idempotent, do nothing
      this.logger.debug(
        `Payment intent ${ziinaPaymentId} already processed or not found`,
      );
      return;
    }

    const amount = parseFloat(intent.amount);

    await this.paymentsRepository.withTransaction(async (client) => {
      await this.paymentsRepository.completeTopup(client, {
        paymentIntentId: intent.id,
        userId: intent.user_id,
        tenantId: intent.tenant_id,
        amount,
      });
    });

    this.logger.log(
      `Wallet topped up: user=${intent.user_id} amount=${amount} AED`,
    );
  }

  /** Verifies the X-Hmac-Signature header from Ziina (hex-encoded SHA-256 HMAC). */
  private verifyHmac(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    // Constant-time comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /** Base URL including tenant subdomain for Ziina browser redirects (frontend origin + protocol). */
  private getTenantPublicBaseUrl(tenantSlug: string): string {
    return buildTenantPublicOrigin(
      resolveWebAppPublicOrigin(this.config),
      this.config.getOrThrow<string>('TENANT_HOST_SUFFIX'),
      tenantSlug,
    );
  }

  /** Called by TenantsService after saving a new Ziina token. Registers webhook with Ziina. */
  async registerWebhookForTenant(tenantId: string): Promise<void> {
    const creds = await this.paymentsRepository.findZiinaCredentials(tenantId);
    if (!creds?.ziina_access_token || !creds.ziina_webhook_secret) return;

    const accessToken = this.cryptoService.decrypt(creds.ziina_access_token);
    const apiOrigin = resolveApiPublicOrigin(this.config);
    const webhookUrl = `${apiOrigin}/payments/webhook`;

    if (!webhookUrl.startsWith('https://')) {
      this.logger.warn(
        `Ziina webhook registration skipped for tenant ${tenantId}: ` +
          `API_PUBLIC_ORIGIN is not a public HTTPS URL ("${webhookUrl}"). ` +
          `Set API_PUBLIC_ORIGIN to your public HTTPS API origin.`,
      );
      return;
    }

    try {
      await this.ziinaClient.registerWebhook(accessToken, {
        url: webhookUrl,
        secret: creds.ziina_webhook_secret,
      });
      this.logger.log(`Ziina webhook registered for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(
        `Failed to register Ziina webhook for tenant ${tenantId}`,
        err,
      );
      throw new UnprocessableEntityException(
        'Ziina token saved but webhook registration failed. Verify the token has write_webhooks scope.',
      );
    }
  }
}

export interface ZiinaWebhookPayload {
  event: string;
  data: {
    id: string;
    status: string;
    [key: string]: unknown;
  };
}
