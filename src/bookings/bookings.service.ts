import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import {
  BookingsRepository,
  type CreateBookingFailureCode,
} from './bookings.repository';
import type { CreateBookingResponseDto } from './dto/create-booking-response.dto';

const FAILURE_MESSAGES: Record<CreateBookingFailureCode, string> = {
  MATCH_NOT_FOUND: 'Match not found',
  USER_NOT_FOUND: 'User not found',
  MATCH_CANCELLED: 'This match has been cancelled',
  MATCH_PAST: 'Cannot book a match that has already started or finished',
  VENUE_INACTIVE: 'Venue is inactive',
  ALREADY_BOOKED: 'You already have a booking for this match',
  INSUFFICIENT_FUNDS:
    'Insufficient wallet balance to book this match. Top up your wallet and try again.',
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly emailService: EmailService,
  ) {}

  async createBookingForPlayer(params: {
    tenantId: string;
    matchId: string;
    userId: string;
  }): Promise<CreateBookingResponseDto> {
    const result = await this.bookingsRepository.createBookingForMatch(params);

    if (!result.success) {
      throw this.mapFailure(result.code);
    }

    const { booking, remainingSpots, emailForConfirmation } = result;

    if (emailForConfirmation) {
      void this.emailService
        .sendBookingConfirmedEmail(emailForConfirmation)
        .catch((err: unknown) => {
          this.logger.warn(
            `sendBookingConfirmedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    return this.toDto(booking, remainingSpots);
  }

  private mapFailure(code: CreateBookingFailureCode): Error {
    const message = FAILURE_MESSAGES[code];
    switch (code) {
      case 'MATCH_NOT_FOUND':
      case 'USER_NOT_FOUND':
        return new NotFoundException(message);
      case 'ALREADY_BOOKED':
        return new ConflictException(message);
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
      created_at: Date;
    },
    remainingSpots: number | null,
  ): CreateBookingResponseDto {
    return {
      id: booking.id,
      matchId: booking.match_id,
      userId: booking.user_id,
      status: booking.status,
      paidAmount: booking.paid_amount,
      createdAt: booking.created_at.toISOString(),
      remainingSpots,
    };
  }
}
