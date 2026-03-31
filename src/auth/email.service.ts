import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    const msg = {
      to,
      from,
      subject: 'Reset your password - Sportbooker',
      text: `Click the link below to reset your password (valid for 1 hour):\n\n${resetLink}`,
      html: `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    };

    if (apiKey) {
      await sgMail.send(msg);
    } else {
      console.warn(
        '[EmailService] SENDGRID_API_KEY not set. Reset link (dev):',
        resetLink,
      );
    }
  }

  async sendBookingConfirmedEmail(to: string): Promise<void> {
    const from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    const msg = {
      to,
      from,
      subject: 'Booking confirmed — Sportbooker',
      text: 'Your spot on the match is confirmed. The fee has been charged to your wallet.',
      html: '<p>Your spot on the match is confirmed. The fee has been charged to your wallet.</p>',
    };

    if (apiKey) {
      await sgMail.send(msg);
    } else {
      console.warn(
        '[EmailService] SENDGRID_API_KEY not set. Booking confirmed (dev), to:',
        to,
      );
    }
  }

  async sendBookingCancelledEmail(to: string): Promise<void> {
    const from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    const msg = {
      to,
      from,
      subject: 'Booking cancelled — Sportbooker',
      text: 'You have cancelled your booking. No refund was issued under the cancellation policy.',
      html: '<p>You have cancelled your booking. No refund was issued under the cancellation policy.</p>',
    };

    if (apiKey) {
      await sgMail.send(msg);
    } else {
      console.warn(
        '[EmailService] SENDGRID_API_KEY not set. Booking cancelled (dev), to:',
        to,
      );
    }
  }

  async sendMatchCancelledEmail(to: string): Promise<void> {
    const from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    const msg = {
      to,
      from,
      subject: 'Match cancelled — Sportbooker',
      text: 'The match you were booked for has been cancelled. Any payment has been refunded to your wallet.',
      html: '<p>The match you were booked for has been cancelled. Any payment has been refunded to your wallet.</p>',
    };

    if (apiKey) {
      await sgMail.send(msg);
    } else {
      console.warn(
        '[EmailService] SENDGRID_API_KEY not set. Match cancelled (dev), to:',
        to,
      );
    }
  }
}
