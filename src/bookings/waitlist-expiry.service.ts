import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

@Injectable()
export class WaitlistExpiryService {
  private readonly logger = new Logger(WaitlistExpiryService.name);
  private isProcessing = false;

  constructor(private readonly bookingsService: BookingsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireWaitlistAndRefundPlayers(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn(
        'Previous waitlist-expiry run still in progress; skipping this tick.',
      );
      return;
    }

    this.isProcessing = true;
    try {
      const refundedCount =
        await this.bookingsService.processExpiredWaitlistRefunds();
      if (refundedCount > 0) {
        this.logger.log(
          `Expired waitlist sweep refunded ${refundedCount} booking(s).`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `expireWaitlistAndRefundPlayers failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
