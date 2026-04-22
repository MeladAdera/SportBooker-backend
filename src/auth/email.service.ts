import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly enabled: boolean;
  private readonly from: string;
  private readonly appName: string;
  private readonly supportEmail: string;
  private readonly browseMatchesLink: string;
  private readonly waitlistRefundEta: string;
  private readonly resend: Resend | null;
  private readonly passwordResetTemplateId: string;
  private readonly emailVerificationTemplateId: string;
  private readonly waitlistExpiredRefundTemplateId: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.enabled = !!apiKey && apiKey !== 'placeholder';
    this.from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@sportbooker.com',
    );
    this.appName = this.config.get<string>('EMAIL_APP_NAME', 'SportBooker');
    this.supportEmail = this.config.get<string>(
      'EMAIL_SUPPORT_EMAIL',
      this.from,
    );
    const webAppOrigin = this.config.get<string>(
      'WEB_APP_PUBLIC_ORIGIN',
      'http://localhost:5173',
    );
    const normalizedWebAppOrigin = webAppOrigin.replace(/\/+$/, '');
    this.browseMatchesLink = `${normalizedWebAppOrigin}/matches`;
    this.waitlistRefundEta = this.config.get<string>(
      'EMAIL_WAITLIST_REFUND_ETA',
      '3-5 business days',
    );
    this.passwordResetTemplateId = this.config.get<string>(
      'RESEND_TEMPLATE_PASSWORD_RESET_ID',
      '432bfd62-0d5e-48cf-ad61-fd3d782b6698',
    );
    this.emailVerificationTemplateId = this.config.get<string>(
      'RESEND_TEMPLATE_EMAIL_VERIFICATION_ID',
      '672a13df-d7f1-499e-9449-d55fb02d26a8',
    );
    this.waitlistExpiredRefundTemplateId = this.config.get<string>(
      'RESEND_TEMPLATE_WAITLIST_EXPIRED_REFUND_ID',
      'e464ed47-8960-4722-b2a1-0e2667813de1',
    );
    this.resend = this.enabled ? new Resend(apiKey) : null;
  }

  /**
   * Centralised guard that drops any outbound email targeted at a synthetic
   * fake-player address (`fake+<uuid>@fake.local`). Fake users exist purely
   * to populate demo matches; they must never receive notifications.
   * Returns true when the address is fake and the message should be skipped.
   */
  private isFakeRecipient(to: string): boolean {
    return /^fake\+[^@]+@fake\.local$/i.test(to.trim());
  }

  private async send(
    params: { to: string; subject: string; text: string; html: string },
    fallbackLabel: string,
    fallbackDetail?: string,
  ): Promise<void> {
    if (this.isFakeRecipient(params.to)) {
      return;
    }
    if (this.enabled && this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      if (error) {
        throw new Error(
          error.message ?? 'Resend returned an error sending email',
        );
      }
    } else {
      console.warn(
        `[EmailService] RESEND_API_KEY not set. ${fallbackLabel}`,
        fallbackDetail ?? '',
      );
    }
  }

  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetLink: string,
  ): Promise<void> {
    await this.sendTemplate(
      {
        to,
        templateId: this.passwordResetTemplateId,
        variables: {
          RESET_LINK: resetLink,
          USER_NAME: userName || 'there',
          APP_NAME: this.appName,
          EXPIRY_TEXT: 'expires in 1 hour',
          SUPPORT_EMAIL: this.supportEmail,
        },
      },
      {
        to,
        subject: 'Reset your password - Sportbooker',
        text: `Click the link below to reset your password (valid for 1 hour):\n\n${resetLink}`,
        html: `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      },
      'Reset link (dev):',
      resetLink,
    );
  }

  async sendEmailVerificationEmail(
    to: string,
    userName: string,
    verificationLink: string,
  ): Promise<void> {
    await this.sendTemplate(
      {
        to,
        templateId: this.emailVerificationTemplateId,
        variables: {
          VERIFY_LINK: verificationLink,
          USER_NAME: userName || 'there',
          APP_NAME: this.appName,
          EXPIRY_TEXT: 'This verification link expires in 24 hours.',
          SUPPORT_EMAIL: this.supportEmail,
        },
      },
      {
        to,
        subject: 'Verify your email - Sportbooker',
        text: `Please verify your email by clicking this link:\n\n${verificationLink}`,
        html: `<p>Please verify your email by clicking this link:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
      },
      'Email verification link (dev):',
      verificationLink,
    );
  }

  async sendBookingConfirmedEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
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
        subject: 'Waitlist — Sportbooker',
        text: 'You were next on the waitlist but your wallet balance was insufficient to take the open spot. Another player may have been promoted instead.',
        html: '<p>You were next on the waitlist but your wallet balance was insufficient to take the open spot. Another player may have been promoted instead.</p>',
      },
      'Waitlist skipped (dev), to:',
      to,
    );
  }

  async sendWaitlistExpiredRefundEmail(params: {
    to: string;
    userName: string;
    sessionName: string;
    venueName: string;
    sessionDate: string;
    refundAmount: string;
  }): Promise<void> {
    await this.sendTemplate(
      {
        to: params.to,
        templateId: this.waitlistExpiredRefundTemplateId,
        variables: {
          APP_NAME: this.appName,
          USER_NAME: params.userName || 'there',
          SESSION_NAME: params.sessionName,
          VENUE_NAME: params.venueName,
          SESSION_DATE: params.sessionDate,
          REFUND_AMOUNT: params.refundAmount,
          REFUND_ETA: this.waitlistRefundEta,
          BROWSE_LINK: this.browseMatchesLink,
          SUPPORT_EMAIL: this.supportEmail,
        },
      },
      {
        to: params.to,
        subject: 'Your waitlist spot has expired - refund issued',
        text: `Hi ${params.userName || 'there'},\n\nYour waitlist spot for ${params.sessionName} at ${params.venueName} on ${params.sessionDate} expired without a confirmed spot becoming available.\n\nA full refund of ${params.refundAmount} has been issued.\n\nBrowse other sessions: ${this.browseMatchesLink}\n\nNeed help? ${this.supportEmail}`,
        html: `<p>Hi ${params.userName || 'there'},</p><p>Your waitlist spot for <strong>${params.sessionName}</strong> at <strong>${params.venueName}</strong> on <strong>${params.sessionDate}</strong> expired without a confirmed spot becoming available.</p><p>A full refund of <strong>${params.refundAmount}</strong> has been issued.</p><p><a href="${this.browseMatchesLink}">Browse other sessions</a></p><p>Need help? <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>`,
      },
      'Waitlist expired refund email (dev), to:',
      params.to,
    );
  }

  async sendBookingCancelledEmail(to: string): Promise<void> {
    await this.send(
      {
        to,
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
        subject: 'Account suspension lifted — Sportbooker',
        text: 'Your account suspension has been lifted. You can now log in and make bookings again.',
        html: '<p>Your account suspension has been lifted. You can now log in and make bookings again.</p>',
      },
      'Account unbanned (dev), to:',
      to,
    );
  }

  private async sendTemplate(
    templateParams: {
      to: string;
      templateId?: string;
      variables: Record<string, unknown>;
      subject?: string;
    },
    fallbackParams: { to: string; subject: string; text: string; html: string },
    fallbackLabel: string,
    fallbackDetail?: string,
  ): Promise<void> {
    if (this.isFakeRecipient(templateParams.to)) {
      return;
    }
    if (
      this.enabled &&
      this.resend &&
      templateParams.templateId &&
      templateParams.templateId.trim().length > 0
    ) {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: templateParams.to,
        ...(templateParams.subject ? { subject: templateParams.subject } : {}),
        template: {
          id: templateParams.templateId,
          variables: templateParams.variables,
        },
      } as never);
      if (error) {
        throw new Error(
          error.message ?? 'Resend returned an error sending template email',
        );
      }
      return;
    }

    await this.send(fallbackParams, fallbackLabel, fallbackDetail);
  }
}
