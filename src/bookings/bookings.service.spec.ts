import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import { BookingPosition } from './booking-position';
import type { BookingDetailRow } from './bookings.repository';
import { WAITLIST_PREPAID_NOTICE } from './waitlist-notice';
import { UserRole } from '../users/user-role';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

/** Let voided async tails (waitlist promotion, emails) finish before assertions. */
async function flushDeferredWork(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepo: jest.Mocked<
    Pick<
      BookingsRepository,
      | 'createBookingForMatch'
      | 'cancelBookingForPlayer'
      | 'promoteWaitlistForMatch'
      | 'findBookingDetailForTenant'
    >
  >;
  let emailService: jest.Mocked<
    Pick<
      EmailService,
      | 'sendBookingConfirmedEmail'
      | 'sendBookingCancelledEmail'
      | 'sendWaitlistPromotedEmail'
      | 'sendWaitlistSkippedEmail'
    >
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
    position: BookingPosition.FieldPlayer,
    created_at: new Date('2026-06-01T12:00:00.000Z'),
    updated_at: new Date('2026-06-01T12:00:00.000Z'),
  };

  const bookingDetailRow: BookingDetailRow = {
    id: bookingRow.id,
    match_id: matchId,
    user_id: userId,
    status: 'confirmed',
    paid_amount: '15.50',
    position: BookingPosition.FieldPlayer,
    cancelled_at: null,
    refunded_at: null,
    created_at: new Date('2026-06-01T12:00:00.000Z'),
    waitlist_position: null,
    match_venue_id: '990e8400-e29b-41d4-a716-446655440010',
    match_title: 'Kickabout',
    sport_type: 'football',
    scheduled_at: new Date('2026-07-01T18:00:00.000Z'),
    duration_mins: 60,
    price_per_player: '20.00',
    match_status: 'upcoming',
    max_players: 10,
    match_created_at: new Date('2026-05-01T00:00:00.000Z'),
    match_updated_at: new Date('2026-05-01T00:00:00.000Z'),
    venue_id: 'aa0e8400-e29b-41d4-a716-446655440020',
    venue_name: 'North Pitch',
    address: '1 Field Rd',
    maps_url: 'https://maps.example.com',
    picture_url: null,
    sport_types: ['football'],
    venue_is_active: true,
    venue_created_at: new Date('2026-01-01T00:00:00.000Z'),
    venue_updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    bookingsRepo = {
      createBookingForMatch: jest.fn(),
      cancelBookingForPlayer: jest.fn(),
      promoteWaitlistForMatch: jest
        .fn()
        .mockResolvedValue({ promotedEmail: null, skippedEmails: [] }),
      findBookingDetailForTenant: jest.fn(),
    };
    emailService = {
      sendBookingConfirmedEmail: jest.fn().mockResolvedValue(undefined),
      sendBookingCancelledEmail: jest.fn().mockResolvedValue(undefined),
      sendWaitlistPromotedEmail: jest.fn().mockResolvedValue(undefined),
      sendWaitlistSkippedEmail: jest.fn().mockResolvedValue(undefined),
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
      waitlistNotice: null,
      waitlistPosition: null,
    });

    const dto = await service.createBookingForPlayer({
      tenantId,
      matchId,
      userId,
    });

    expect(dto.id).toBe(bookingRow.id);
    expect(dto.status).toBe('confirmed');
    expect(dto.position).toBe(BookingPosition.FieldPlayer);
    expect(dto.waitlistNotice).toBeNull();
    expect(dto.waitlistPosition).toBeNull();
    expect(dto.remainingSpots).toBe(5);
    expect(bookingsRepo.createBookingForMatch).toHaveBeenCalledWith({
      tenantId,
      matchId,
      userId,
      position: BookingPosition.FieldPlayer,
    });
    expect(emailService.sendBookingConfirmedEmail).toHaveBeenCalledWith(
      'p@example.com',
    );
  });

  it('passes goalkeeper position to repository', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: true,
      booking: { ...bookingRow, position: BookingPosition.Goalkeeper },
      remainingSpots: 3,
      emailForConfirmation: 'gk@example.com',
      waitlistNotice: null,
      waitlistPosition: null,
    });

    await service.createBookingForPlayer({
      tenantId,
      matchId,
      userId,
      position: BookingPosition.Goalkeeper,
    });

    expect(bookingsRepo.createBookingForMatch).toHaveBeenCalledWith({
      tenantId,
      matchId,
      userId,
      position: BookingPosition.Goalkeeper,
    });
  });

  it('does not send email for waitlist (pending); returns prepaid notice and position', async () => {
    bookingsRepo.createBookingForMatch.mockResolvedValue({
      success: true,
      booking: {
        ...bookingRow,
        status: 'pending',
        paid_amount: '15.50',
      },
      remainingSpots: 0,
      emailForConfirmation: null,
      waitlistNotice: WAITLIST_PREPAID_NOTICE,
      waitlistPosition: 3,
    });

    const dto = await service.createBookingForPlayer({
      tenantId,
      matchId,
      userId,
    });

    expect(emailService.sendBookingConfirmedEmail).not.toHaveBeenCalled();
    expect(dto.waitlistNotice).toBe(WAITLIST_PREPAID_NOTICE);
    expect(dto.waitlistPosition).toBe(3);
    expect(dto.paidAmount).toBe('15.50');
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

  describe('cancelBookingForPlayer', () => {
    const cancelledAt = new Date('2026-06-10T10:00:00.000Z');

    it('returns DTO, runs waitlist promotion after commit, sends waitlist_promoted and skipped emails', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: true,
        cancelledAt,
        refundAmount: '0.00',
        playerEmail: 'player@example.com',
        shouldPromoteWaitlist: true,
      });
      bookingsRepo.promoteWaitlistForMatch.mockResolvedValue({
        promotedEmail: 'promoted@example.com',
        skippedEmails: ['skipped@example.com'],
      });

      const dto = await service.cancelBookingForPlayer({
        tenantId,
        matchId,
        bookingId: bookingRow.id,
        userId,
        cancelCutoffHours: 24,
      });

      expect(dto).toEqual({
        cancelled: true,
        cancelledAt: cancelledAt.toISOString(),
        refundAmount: '0.00',
      });
      expect(bookingsRepo.promoteWaitlistForMatch).toHaveBeenCalledWith({
        tenantId,
        matchId,
      });
      await flushDeferredWork();
      expect(emailService.sendBookingCancelledEmail).toHaveBeenCalledWith(
        'player@example.com',
      );
      expect(emailService.sendWaitlistPromotedEmail).toHaveBeenCalledWith(
        'promoted@example.com',
      );
      expect(emailService.sendWaitlistSkippedEmail).toHaveBeenCalledWith(
        'skipped@example.com',
      );
    });

    it('returns paid refund amount when confirmed cancel is outside cutoff (early cancel)', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: true,
        cancelledAt,
        refundAmount: '25.00',
        playerEmail: 'player@example.com',
        shouldPromoteWaitlist: true,
      });
      bookingsRepo.promoteWaitlistForMatch.mockResolvedValue({
        promotedEmail: null,
        skippedEmails: [],
      });

      const dto = await service.cancelBookingForPlayer({
        tenantId,
        matchId,
        bookingId: bookingRow.id,
        userId,
        cancelCutoffHours: 24,
      });

      expect(dto.refundAmount).toBe('25.00');
      expect(bookingsRepo.promoteWaitlistForMatch).toHaveBeenCalled();
    });

    it('does not run waitlist promotion when cancelling prepaid waitlist', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: true,
        cancelledAt,
        refundAmount: '15.50',
        playerEmail: 'wl@example.com',
        shouldPromoteWaitlist: false,
      });

      const dto = await service.cancelBookingForPlayer({
        tenantId,
        matchId,
        bookingId: bookingRow.id,
        userId,
        cancelCutoffHours: 24,
      });

      expect(dto.refundAmount).toBe('15.50');
      await flushDeferredWork();
      expect(bookingsRepo.promoteWaitlistForMatch).not.toHaveBeenCalled();
    });

    it('does not send waitlist emails when promotion finds no one', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: true,
        cancelledAt,
        refundAmount: '0.00',
        playerEmail: 'player@example.com',
        shouldPromoteWaitlist: true,
      });
      bookingsRepo.promoteWaitlistForMatch.mockResolvedValue({
        promotedEmail: null,
        skippedEmails: [],
      });

      await service.cancelBookingForPlayer({
        tenantId,
        matchId,
        bookingId: bookingRow.id,
        userId,
        cancelCutoffHours: 24,
      });

      await flushDeferredWork();
      expect(emailService.sendBookingCancelledEmail).toHaveBeenCalled();
      expect(emailService.sendWaitlistPromotedEmail).not.toHaveBeenCalled();
      expect(emailService.sendWaitlistSkippedEmail).not.toHaveBeenCalled();
    });

    it('throws NotFound when booking missing', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: false,
        code: 'BOOKING_NOT_FOUND',
      });

      await expect(
        service.cancelBookingForPlayer({
          tenantId,
          matchId,
          bookingId: bookingRow.id,
          userId,
          cancelCutoffHours: 24,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when not owner', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: false,
        code: 'NOT_OWNER',
      });

      await expect(
        service.cancelBookingForPlayer({
          tenantId,
          matchId,
          bookingId: bookingRow.id,
          userId,
          cancelCutoffHours: 24,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when already cancelled', async () => {
      bookingsRepo.cancelBookingForPlayer.mockResolvedValue({
        success: false,
        code: 'ALREADY_CANCELLED',
      });

      await expect(
        service.cancelBookingForPlayer({
          tenantId,
          matchId,
          bookingId: bookingRow.id,
          userId,
          cancelCutoffHours: 24,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBookingDetail', () => {
    it('returns detail when player owns booking', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue(
        bookingDetailRow,
      );

      const dto = await service.getBookingDetail({
        tenantId,
        bookingId: bookingRow.id,
        actorUserId: userId,
        actorRole: UserRole.Player,
      });

      expect(dto.id).toBe(bookingRow.id);
      expect(dto.match.title).toBe('Kickabout');
      expect(dto.venue.name).toBe('North Pitch');
      expect(dto.cancelledAt).toBeNull();
    });

    it('returns detail for tenant_admin viewing another user booking', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue(
        bookingDetailRow,
      );

      await service.getBookingDetail({
        tenantId,
        bookingId: bookingRow.id,
        actorUserId: 'other-user-uuid',
        actorRole: UserRole.TenantAdmin,
      });

      expect(bookingsRepo.findBookingDetailForTenant).toHaveBeenCalledWith({
        bookingId: bookingRow.id,
        tenantId,
      });
    });

    it('throws NotFound when booking missing', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue(null);

      await expect(
        service.getBookingDetail({
          tenantId,
          bookingId: bookingRow.id,
          actorUserId: userId,
          actorRole: UserRole.Player,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when player requests another user booking', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue(
        bookingDetailRow,
      );

      await expect(
        service.getBookingDetail({
          tenantId,
          bookingId: bookingRow.id,
          actorUserId: 'other-user-uuid',
          actorRole: UserRole.Player,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns waitlistPosition for pending booking', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue({
        ...bookingDetailRow,
        status: 'pending',
        waitlist_position: 2,
      });

      const dto = await service.getBookingDetail({
        tenantId,
        bookingId: bookingRow.id,
        actorUserId: userId,
        actorRole: UserRole.Player,
      });

      expect(dto.status).toBe('pending');
      expect(dto.waitlistPosition).toBe(2);
    });

    it('returns null waitlistPosition for confirmed booking', async () => {
      bookingsRepo.findBookingDetailForTenant.mockResolvedValue(
        bookingDetailRow,
      );

      const dto = await service.getBookingDetail({
        tenantId,
        bookingId: bookingRow.id,
        actorUserId: userId,
        actorRole: UserRole.Player,
      });

      expect(dto.status).toBe('confirmed');
      expect(dto.waitlistPosition).toBeNull();
    });
  });
});
