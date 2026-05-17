import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import type { VenueSportType } from '../venues/venue-sport-type';
import {
  BookingsRepository,
  type BookingDetailRow,
  type CancelPlayerBookingFailureCode,
  type CreateBookingFailureCode,
  type ExpiredWaitlistRefundRow,
} from './bookings.repository';
import type { BookingDetailResponseDto } from './dto/booking-detail-response.dto';
import type { CancelPlayerBookingResponseDto } from './dto/cancel-player-booking-response.dto';
import type { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UserRole } from '../users/user-role';
import { BookingPosition } from './booking-position';
import { ConfigService } from '@nestjs/config';

const FAILURE_MESSAGES: Record<CreateBookingFailureCode, string> = {
  MATCH_NOT_FOUND: 'Match not found',
  USER_NOT_FOUND: 'User not found',
  USER_BANNED: 'Your account has been suspended and cannot make new bookings',
  MATCH_CANCELLED: 'This match has been cancelled',
  MATCH_PAST: 'Cannot book a match that has already started or finished',
  VENUE_INACTIVE: 'Venue is inactive',
  ALREADY_BOOKED: 'You already have a booking for this match',
  INSUFFICIENT_FUNDS:
    'Insufficient wallet balance to book this match. Top up your wallet and try again.',
};

const CANCEL_PLAYER_MESSAGES: Record<CancelPlayerBookingFailureCode, string> = {
  BOOKING_NOT_FOUND: 'Booking not found',
  NOT_OWNER: 'You can only cancel your own booking',
  NOT_CONFIRMED: 'Only confirmed bookings can be cancelled',
  ALREADY_CANCELLED: 'Booking is already cancelled',
  MATCH_CANCELLED: 'This match has been cancelled',
  MATCH_PAST: 'Cannot cancel a match that has already started or finished',
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async createBookingForPlayer(params: {
    tenantId: string;
    matchId: string;
    userId: string;
    position?: BookingPosition;
  }): Promise<CreateBookingResponseDto> {
    const result = await this.bookingsRepository.createBookingForMatch({
      ...params,
      position: params.position ?? BookingPosition.FieldPlayer,
    });

    if (!result.success) {
      throw this.mapFailure(result.code);
    }

    const {
      booking,
      remainingSpots,
      emailForConfirmation,
      waitlistNotice,
      waitlistPosition,
    } = result;

    if (emailForConfirmation) {
      void this.emailService
        .sendBookingConfirmedEmail(emailForConfirmation)
        .catch((err: unknown) => {
          this.logger.warn(
            `sendBookingConfirmedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    return this.toDto(
      booking,
      remainingSpots,
      waitlistNotice,
      waitlistPosition,
    );
  }

  async cancelBookingForPlayer(params: {
    tenantId: string;
    matchId: string;
    bookingId: string;
    userId: string;
    cancelCutoffHours: number;
  }): Promise<CancelPlayerBookingResponseDto> {
    const result = await this.bookingsRepository.cancelBookingForPlayer(params);

    if (!result.success) {
      throw this.mapCancelPlayerFailure(result.code);
    }

    const { cancelledAt, playerEmail, shouldPromoteWaitlist } = result;

    void this.emailService
      .sendBookingCancelledEmail(playerEmail)
      .catch((err: unknown) => {
        this.logger.warn(
          `sendBookingCancelledEmail failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    if (shouldPromoteWaitlist) {
      // Do not await — promotion is a separate transaction; response should return immediately.
      // TODO: move to a job queue (e.g. SLOT_OPENED) when background workers exist.
      void this.promoteWaitlistAfterSpotOpened(
        params.tenantId,
        params.matchId,
      ).catch((err: unknown) => {
        this.logger.error(
          `promoteWaitlistAfterSpotOpened rejected: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });
    }

    return {
      cancelled: true,
      cancelledAt: cancelledAt.toISOString(),
      refundAmount: result.refundAmount,
    };
  }

  async getBookingDetail(params: {
    tenantId: string;
    bookingId: string;
    actorUserId: string;
    actorRole: string;
  }): Promise<BookingDetailResponseDto> {
    const row = await this.bookingsRepository.findBookingDetailForTenant({
      bookingId: params.bookingId,
      tenantId: params.tenantId,
    });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }

    const actorRole = params.actorRole as UserRole;
    const canViewAll =
      actorRole === UserRole.SuperAdmin ||
      actorRole === UserRole.TenantAdmin ||
      actorRole === UserRole.TenantStaff ||
      row.user_id === params.actorUserId;

    if (!canViewAll) {
      throw new NotFoundException('Booking not found');
    }

    return this.toBookingDetailDto(row);
  }

  /**
   * FIFO waitlist promotion after a confirmed slot opens (player cancel or admin removal).
   * Does not run for match-level cancellation. Separate transaction from the opening operation.
   * Invoked without await from player cancel so the HTTP response is not blocked.
   */
  async promoteWaitlistAfterSpotOpened(
    tenantId: string,
    matchId: string,
  ): Promise<void> {
    try {
      const { promotedEmail, skippedEmails } =
        await this.bookingsRepository.promoteWaitlistForMatch({
          tenantId,
          matchId,
        });

      for (const email of skippedEmails) {
        void this.emailService
          .sendWaitlistSkippedEmail(email)
          .catch((err: unknown) => {
            this.logger.warn(
              `sendWaitlistSkippedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }

      if (promotedEmail) {
        void this.emailService
          .sendWaitlistPromotedEmail(promotedEmail)
          .catch((err: unknown) => {
            this.logger.warn(
              `sendWaitlistPromotedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    } catch (err: unknown) {
      this.logger.error(
        `promoteWaitlistAfterSpotOpened failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  async processExpiredWaitlistRefunds(): Promise<number> {
    const expiredRefunds =
      await this.bookingsRepository.refundExpiredWaitlistBookings();

    if (expiredRefunds.length === 0) {
      return 0;
    }

    await Promise.all(
      expiredRefunds.map((refund) =>
        this.sendWaitlistExpiryRefundEmail(refund),
      ),
    );

    return expiredRefunds.length;
  }

  private mapCancelPlayerFailure(code: CancelPlayerBookingFailureCode): Error {
    const message = CANCEL_PLAYER_MESSAGES[code];
    switch (code) {
      case 'BOOKING_NOT_FOUND':
        return new NotFoundException(message);
      case 'NOT_OWNER':
        return new ForbiddenException(message);
      default:
        return new BadRequestException(message);
    }
  }

  private mapFailure(code: CreateBookingFailureCode): Error {
    const message = FAILURE_MESSAGES[code];
    switch (code) {
      case 'MATCH_NOT_FOUND':
      case 'USER_NOT_FOUND':
        return new NotFoundException(message);
      case 'ALREADY_BOOKED':
        return new ConflictException(message);
      case 'USER_BANNED':
        return new ForbiddenException(message);
      default:
        return new BadRequestException(message);
    }
  }

  private toDto(
    booking: {
      id: string;
      match_id: string;
      user_id: string;
      status: string;
      paid_amount: string;
      position: string;
      created_at: Date;
    },
    remainingSpots: number | null,
    waitlistNotice: string | null,
    waitlistPosition: number | null,
  ): CreateBookingResponseDto {
    return {
      id: booking.id,
      matchId: booking.match_id,
      userId: booking.user_id,
      status: booking.status,
      paidAmount: booking.paid_amount,
      position: booking.position as BookingPosition,
      createdAt: booking.created_at.toISOString(),
      remainingSpots,
      waitlistNotice:
        booking.status === 'pending' ? (waitlistNotice ?? null) : null,
      waitlistPosition: booking.status === 'pending' ? waitlistPosition : null,
    };
  }

  private toBookingDetailDto(row: BookingDetailRow): BookingDetailResponseDto {
    return {
      id: row.id,
      matchId: row.match_id,
      userId: row.user_id,
      status: row.status,
      paidAmount: row.paid_amount,
      position: row.position as BookingPosition,
      cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
      refundedAt: row.refunded_at ? row.refunded_at.toISOString() : null,
      waitlistPosition: row.waitlist_position ?? null,
      createdAt: row.created_at.toISOString(),
      match: {
        id: row.match_id,
        venueId: row.match_venue_id,
        title: row.match_title,
        sportType: row.sport_type as VenueSportType,
        scheduledAt: row.scheduled_at.toISOString(),
        durationMins: row.duration_mins,
        maxPlayers: row.max_players,
        pricePerPlayer: Number(row.price_per_player),
        status: row.match_status,
        createdAt: row.match_created_at.toISOString(),
        updatedAt: row.match_updated_at.toISOString(),
      },
      venue: {
        id: row.venue_id,
        name: row.venue_name,
        address: row.address,
        mapsUrl: row.maps_url,
        sportTypes: row.sport_types as VenueSportType[],
        isActive: row.venue_is_active,
        pictureUrl: row.picture_url,
        createdAt: row.venue_created_at.toISOString(),
        updatedAt: row.venue_updated_at.toISOString(),
      },
    };
  }

  private async sendWaitlistExpiryRefundEmail(
    refund: ExpiredWaitlistRefundRow,
  ): Promise<void> {
    const sessionDate = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(refund.scheduledAt);
    const currency = this.configService.get<string>('WALLET_CURRENCY', 'AED');

    try {
      await this.emailService.sendWaitlistExpiredRefundEmail({
        to: refund.userEmail,
        userName: refund.userName,
        sessionName: refund.matchTitle,
        venueName: refund.venueName,
        sessionDate: `${sessionDate} UTC`,
        refundAmount: `${currency} ${refund.refundAmount}`,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `sendWaitlistExpiredRefundEmail failed for booking ${refund.bookingId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
