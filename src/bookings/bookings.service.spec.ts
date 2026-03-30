import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepo: jest.Mocked<
    Pick<BookingsRepository, 'createBookingForMatch'>
  >;
  let emailService: jest.Mocked<
    Pick<EmailService, 'sendBookingConfirmedEmail'>
  >;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const matchId = '660e8400-e29b-41d4-a716-446655440001';
  const userId = '770e8400-e29b-41d4-a716-446655440002';

  const bookingRow = {
    id: '880e8400-e29b-41d4-a716-446655440003',
    match_id: matchId,
    user_id: userId,
    status: 'confirmed',
    paid_amount: '15.50',
    created_at: new Date('2026-06-01T12:00:00.000Z'),
    updated_at: new Date('2026-06-01T12:00:00.000Z'),
  };

  beforeEach(() => {
    bookingsRepo = {
      createBookingForMatch: jest.fn(),
    };
    emailService = {
      sendBookingConfirmedEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new BookingsService(
      bookingsRepo as unknown as BookingsRepository,
      emailService as unknown as EmailService,
    );
  });

  it('returns booking DTO and fires email after confirmed booking', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: true,
      booking: bookingRow,
      remainingSpots: 5,
      emailForConfirmation: 'p@example.com',
    });

    const dto = await service.createBookingForPlayer({
      tenantId,
      matchId,
      userId,
    });

    expect(dto.id).toBe(bookingRow.id);
    expect(dto.status).toBe('confirmed');
    expect(dto.remainingSpots).toBe(5);
    expect(emailService.sendBookingConfirmedEmail).toHaveBeenCalledWith(
      'p@example.com',
    );
  });

  it('does not send email for waitlist (pending)', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: true,
      booking: { ...bookingRow, status: 'pending', paid_amount: '0' },
      remainingSpots: 0,
      emailForConfirmation: null,
    });

    await service.createBookingForPlayer({ tenantId, matchId, userId });

    expect(emailService.sendBookingConfirmedEmail).not.toHaveBeenCalled();
  });

  it('throws NotFound when match not found', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: false,
      code: 'MATCH_NOT_FOUND',
    });

    await expect(
      service.createBookingForPlayer({ tenantId, matchId, userId }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws Conflict when already booked', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: false,
      code: 'ALREADY_BOOKED',
    });

    await expect(
      service.createBookingForPlayer({ tenantId, matchId, userId }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequest when insufficient funds', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: false,
      code: 'INSUFFICIENT_FUNDS',
    });

    await expect(
      service.createBookingForPlayer({ tenantId, matchId, userId }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequest when match cancelled', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: false,
      code: 'MATCH_CANCELLED',
    });

    await expect(
      service.createBookingForPlayer({ tenantId, matchId, userId }),
    ).rejects.toThrow(BadRequestException);
  });
});
