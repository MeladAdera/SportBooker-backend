import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sgMail = require('@sendgrid/mail') as {
  setApiKey: (key: string) => void;
  send: (msg: Record<string, unknown>) => Promise<unknown>;
};

@Injectable()
export class EmailService {
  private readonly enabled: boolean;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    this.enabled = !!apiKey && apiKey !== 'placeholder';
    this.from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    if (this.enabled) {
      sgMail.setApiKey(apiKey!);
    }
  }

  private async send(
    msg: Record<string, unknown>,
    fallbackLabel: string,
    fallbackDetail?: string,
  ): Promise<void> {
    if (this.enabled) {
      await sgMail.send(msg);
    } else {
      console.warn(
        `[EmailService] SENDGRID_API_KEY not set. ${fallbackLabel}`,
        fallbackDetail ?? '',
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Reset your password - Sportbooker',
        text: `Click the link below to reset your password (valid for 1 hour):\n\n${resetLink}`,
        html: `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      },
      'Reset link (dev):',
      resetLink,
    );
  }

  async sendBookingConfirmedEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Booking confirmed — Sportbooker',
        text: 'Your spot on the match is confirmed. The fee has been charged to your wallet.',
        html: '<p>Your spot on the match is confirmed. The fee has been charged to your wallet.</p>',
      },
      'Booking confirmed (dev), to:',
      to,
    );
  }

  async sendWaitlistPromotedEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'You have been promoted from the waitlist — Sportbooker',
        text: 'A spot opened and you have been confirmed on the match. The fee has been charged to your wallet.',
        html: '<p>A spot opened and you have been confirmed on the match. The fee has been charged to your wallet.</p>',
      },
      'Waitlist promoted (dev), to:',
      to,
    );
  }

  async sendWaitlistSkippedEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Waitlist — Sportbooker',
        text: 'You were next on the waitlist but your wallet balance was insufficient to take the open spot. Another player may have been promoted instead.',
        html: '<p>You were next on the waitlist but your wallet balance was insufficient to take the open spot. Another player may have been promoted instead.</p>',
      },
      'Waitlist skipped (dev), to:',
      to,
    );
  }

  async sendBookingCancelledEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Booking cancelled — Sportbooker',
        text: 'You have cancelled your booking. No refund was issued under the cancellation policy.',
        html: '<p>You have cancelled your booking. No refund was issued under the cancellation policy.</p>',
      },
      'Booking cancelled (dev), to:',
      to,
    );
  }

  async sendMatchCancelledEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Match cancelled — Sportbooker',
        text: 'The match you were booked for has been cancelled. Any payment has been refunded to your wallet.',
        html: '<p>The match you were booked for has been cancelled. Any payment has been refunded to your wallet.</p>',
      },
      'Match cancelled (dev), to:',
      to,
    );
  }

  async sendAccountBannedEmail(
    to: string,
    bannedUntil: Date | null,
  ): Promise<void> {
    const expiry = bannedUntil
      ? `Your suspension is in effect until ${bannedUntil.toUTCString()}.`
      : 'Your suspension is permanent until reviewed by the club.';
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Account suspended — Sportbooker',
        text: `Your account has been suspended by the club administrator. ${expiry} Any upcoming bookings have been cancelled and refunded to your wallet.`,
        html: `<p>Your account has been suspended by the club administrator. ${expiry}</p><p>Any upcoming bookings have been cancelled and refunded to your wallet.</p>`,
      },
      'Account banned (dev), to:',
      to,
    );
  }

  async sendAccountUnbannedEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
        from: this.from,
        subject: 'Account suspension lifted — Sportbooker',
        text: 'Your account suspension has been lifted. You can now log in and make bookings again.',
        html: '<p>Your account suspension has been lifted. You can now log in and make bookings again.</p>',
      },
      'Account unbanned (dev), to:',
      to,
    );
  }
}
