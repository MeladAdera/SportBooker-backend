import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import { BookingPosition } from '../bookings/booking-position';
import { BookingsRepository } from '../bookings/bookings.repository';
import { VenueSportType } from '../venues/venue-sport-type';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { VenuesRepository } from '../venues/venues.repository';

describe('MatchesService', () => {
  let service: MatchesService;
  let matchesRepo: jest.Mocked<
    Pick<
      MatchesRepository,
      | 'countConfirmedBookingsForMatch'
      | 'countUpcomingMatchesForBrowse'
      | 'findMatchDetailForTenant'
      | 'findMatchRowForTenant'
      | 'findUpcomingMatchesForBrowse'
      | 'findWaitlistForMatch'
      | 'hasOverlappingMatchAtVenue'
      | 'insertMatch'
      | 'patchMatchForTenant'
    >
  >;
  let venuesRepo: jest.Mocked<
    Pick<VenuesRepository, 'findVenueRowByIdForTenant'>
  >;
  let bookingsRepo: jest.Mocked<
    Pick<
      BookingsRepository,
      'cancelMatchForTenant' | 'removeFromWaitlistForTenant'
    >
  >;
  let emailService: jest.Mocked<
    Pick<EmailService, 'sendMatchCancelledEmail' | 'sendBookingCancelledEmail'>
  >;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const venueId = '660e8400-e29b-41d4-a716-446655440001';

  const matchRow = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    venue_id: venueId,
    title: 'Sunday league',
    sport_type: 'football',
    scheduled_at: new Date('2026-06-01T18:00:00.000Z'),
    duration_mins: 90,
    price_per_player: '15.00',
    status: 'upcoming',
    max_players: 22,
    created_at: new Date('2026-01-01T12:00:00.000Z'),
    updated_at: new Date('2026-01-01T12:00:00.000Z'),
  };

  beforeEach(() => {
    matchesRepo = {
      countConfirmedBookingsForMatch: jest.fn(),
      countUpcomingMatchesForBrowse: jest.fn(),
      findMatchDetailForTenant: jest.fn(),
      findMatchRowForTenant: jest.fn(),
      findUpcomingMatchesForBrowse: jest.fn(),
      findWaitlistForMatch: jest.fn().mockResolvedValue([]),
      hasOverlappingMatchAtVenue: jest.fn().mockResolvedValue(false),
      insertMatch: jest.fn(),
      patchMatchForTenant: jest.fn(),
    };
    venuesRepo = {
      findVenueRowByIdForTenant: jest.fn(),
    };
    bookingsRepo = {
      cancelMatchForTenant: jest.fn(),
      removeFromWaitlistForTenant: jest.fn(),
    };
    emailService = {
      sendMatchCancelledEmail: jest.fn().mockResolvedValue(undefined),
      sendBookingCancelledEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new MatchesService(
      matchesRepo as unknown as MatchesRepository,
      venuesRepo as unknown as VenuesRepository,
      bookingsRepo as unknown as BookingsRepository,
      emailService as unknown as EmailService,
    );
  });

  it('lists upcoming matches with pagination defaults', async () => {
    matchesRepo.countUpcomingMatchesForBrowse.mockResolvedValue(1);
    matchesRepo.findUpcomingMatchesForBrowse.mockResolvedValue([
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        title: 'Sunday league',
        sport_type: 'football',
        scheduled_at: new Date('2026-06-01T18:00:00.000Z'),
        duration_mins: 90,
        price_per_player: '10.00',
        max_players: 22,
        status: 'upcoming',
        venue_name: 'Main Pitch',
        spots_remaining: 20,
        waitlist_count: 2,
      },
    ]);

    const result = await service.listUpcomingForTenant(tenantId, {});

    expect(matchesRepo.countUpcomingMatchesForBrowse).toHaveBeenCalledWith({
      tenantId,
      sportType: null,
      venueId: null,
      date: null,
      available: null,
    });
    expect(matchesRepo.findUpcomingMatchesForBrowse).toHaveBeenCalledWith({
      tenantId,
      sportType: null,
      venueId: null,
      date: null,
      available: null,
      limit: 20,
      offset: 0,
    });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: '770e8400-e29b-41d4-a716-446655440002',
      title: 'Sunday league',
      sportType: VenueSportType.Football,
      venueName: 'Main Pitch',
      spotsRemaining: 20,
      waitlistCount: 2,
      maxCapacity: 22,
      status: 'upcoming',
    });
  });

  it('returns match detail with roster and spotsRemaining', async () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440002';
    const playerId = '880e8400-e29b-41d4-a716-446655440003';
    matchesRepo.findMatchDetailForTenant.mockResolvedValue({
      id: matchId,
      venue_id: venueId,
      venue_name: 'Main Pitch',
      venue_address: '1 Example Rd',
      venue_picture_url: 'https://cdn.example.com/venue.jpg',
      title: 'Cup',
      sport_type: 'football',
      scheduled_at: new Date('2026-07-01T12:00:00.000Z'),
      duration_mins: 60,
      price_per_player: '12.00',
      status: 'upcoming',
      max_players: 10,
      created_at: new Date(),
      updated_at: new Date(),
      spots_remaining: 8,
      roster: [
        {
          userId: playerId,
          name: 'Alex',
          position: BookingPosition.FieldPlayer,
          photoUrl: 'https://cdn.example.com/p.jpg',
        },
      ],
      waitlist: [
        {
          userId: '990e8400-e29b-41d4-a716-446655440004',
          name: 'Bob',
          position: BookingPosition.FieldPlayer,
          photoUrl: null,
          queuePosition: 1,
          joinedAt: '2026-07-01T10:00:00.000Z',
        },
      ],
      waitlist_count: 1,
    });

    const result = await service.getDetailForTenant(tenantId, matchId);

    expect(matchesRepo.findMatchDetailForTenant).toHaveBeenCalledWith(
      matchId,
      tenantId,
    );
    expect(result.spotsRemaining).toBe(8);
    expect(result.venueName).toBe('Main Pitch');
    expect(result.venueAddress).toBe('1 Example Rd');
    expect(result.venuePictureUrl).toBe('https://cdn.example.com/venue.jpg');
    expect(result.roster).toHaveLength(1);
    expect(result.roster[0]).toEqual({
      userId: playerId,
      name: 'Alex',
      position: BookingPosition.FieldPlayer,
      photoUrl: 'https://cdn.example.com/p.jpg',
    });
    expect(result.waitlistCount).toBe(1);
    expect(result.waitlist).toHaveLength(1);
    expect(result.waitlist[0]).toEqual({
      userId: '990e8400-e29b-41d4-a716-446655440004',
      name: 'Bob',
      position: BookingPosition.FieldPlayer,
      photoUrl: null,
      queuePosition: 1,
      joinedAt: '2026-07-01T10:00:00.000Z',
    });
  });

  it('throws NotFoundException when match detail not in tenant', async () => {
    matchesRepo.findMatchDetailForTenant.mockResolvedValue(null);

    await expect(
      service.getDetailForTenant(
        tenantId,
        '770e8400-e29b-41d4-a716-446655440002',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  const baseDto = {
    title: 'Sunday league',
    sportType: VenueSportType.Football,
    venueId,
    scheduledAt: '2026-06-01T18:00:00.000Z',
    durationMins: 90,
    maxCapacity: 22,
    pricePerPlayer: 15,
  };

  it('creates a match when venue is active', async () => {
    venuesRepo.findVenueRowByIdForTenant.mockResolvedValue({
      id: venueId,
      tenant_id: tenantId,
      name: 'Pitch',
      address: '1 Rd',
      maps_url: 'https://m.test/x',
      picture_url: null,
      sport_types: ['football'],
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    matchesRepo.insertMatch.mockResolvedValue(matchRow);

    const result = await service.createForTenant(tenantId, baseDto);

    expect(matchesRepo.hasOverlappingMatchAtVenue).toHaveBeenCalledWith(
      venueId,
      new Date('2026-06-01T18:00:00.000Z'),
      90,
    );
    expect(matchesRepo.insertMatch).toHaveBeenCalledWith({
      venueId,
      title: 'Sunday league',
      sportType: VenueSportType.Football,
      scheduledAt: new Date('2026-06-01T18:00:00.000Z'),
      durationMins: 90,
      maxPlayers: 22,
      pricePerPlayer: 15,
    });
    expect(result).toMatchObject({
      id: matchRow.id,
      title: 'Sunday league',
      sportType: VenueSportType.Football,
      venueId,
      durationMins: 90,
      maxCapacity: 22,
      pricePerPlayer: 15,
      status: 'upcoming',
    });
    expect(result.scheduledAt).toBe('2026-06-01T18:00:00.000Z');
  });

  it('throws NotFoundException when venue is missing or not in tenant', async () => {
    venuesRepo.findVenueRowByIdForTenant.mockResolvedValue(null);

    await expect(service.createForTenant(tenantId, baseDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(matchesRepo.insertMatch).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when venue is inactive', async () => {
    venuesRepo.findVenueRowByIdForTenant.mockResolvedValue({
      id: venueId,
      tenant_id: tenantId,
      name: 'Pitch',
      address: '1 Rd',
      maps_url: 'https://m.test/x',
      picture_url: null,
      sport_types: ['football'],
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(service.createForTenant(tenantId, baseDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(matchesRepo.insertMatch).not.toHaveBeenCalled();
  });

  it('throws ConflictException when another match overlaps this time slot', async () => {
    matchesRepo.hasOverlappingMatchAtVenue.mockResolvedValue(true);
    venuesRepo.findVenueRowByIdForTenant.mockResolvedValue({
      id: venueId,
      tenant_id: tenantId,
      name: 'Pitch',
      address: '1 Rd',
      maps_url: 'https://m.test/x',
      picture_url: null,
      sport_types: ['football'],
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(service.createForTenant(tenantId, baseDto)).rejects.toThrow(
      ConflictException,
    );
    expect(matchesRepo.insertMatch).not.toHaveBeenCalled();
  });

  it('throws ConflictException on unique venue + scheduled time', async () => {
    venuesRepo.findVenueRowByIdForTenant.mockResolvedValue({
      id: venueId,
      tenant_id: tenantId,
      name: 'Pitch',
      address: '1 Rd',
      maps_url: 'https://m.test/x',
      picture_url: null,
      sport_types: ['football'],
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    matchesRepo.insertMatch.mockRejectedValue({ code: '23505' });

    await expect(service.createForTenant(tenantId, baseDto)).rejects.toThrow(
      ConflictException,
    );
  });

  describe('updateForTenant', () => {
    const matchId = matchRow.id;

    it('patches title and returns updated match', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(matchRow);
      matchesRepo.countConfirmedBookingsForMatch.mockResolvedValue(0);
      matchesRepo.patchMatchForTenant.mockResolvedValue({
        ...matchRow,
        title: 'Renamed',
      });

      const result = await service.updateForTenant(tenantId, matchId, {
        title: 'Renamed',
      });

      expect(matchesRepo.patchMatchForTenant).toHaveBeenCalledWith(
        tenantId,
        matchId,
        { title: 'Renamed' },
      );
      expect(result.title).toBe('Renamed');
    });

    it('throws BadRequestException when no fields provided', async () => {
      await expect(
        service.updateForTenant(tenantId, matchId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when match missing', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(null);

      await expect(
        service.updateForTenant(tenantId, matchId, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when match is cancelled', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue({
        ...matchRow,
        status: 'cancelled',
      });

      await expect(
        service.updateForTenant(tenantId, matchId, { title: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when maxCapacity below confirmed count', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(matchRow);
      matchesRepo.countConfirmedBookingsForMatch.mockResolvedValue(5);

      await expect(
        service.updateForTenant(tenantId, matchId, { maxCapacity: 3 }),
      ).rejects.toThrow(ConflictException);
      expect(matchesRepo.patchMatchForTenant).not.toHaveBeenCalled();
    });
  });

  describe('cancelMatchForTenant', () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440002';

    it('returns counts and sends one email per distinct confirmed player', async () => {
      bookingsRepo.cancelMatchForTenant.mockResolvedValue({
        success: true,
        cancelledBookings: 2,
        refundedAmount: '31.00',
        emailsForMatchCancelled: ['a@test.com', 'a@test.com'],
      });

      const result = await service.cancelMatchForTenant(tenantId, matchId);

      expect(result).toEqual({
        cancelledBookings: 2,
        refundedAmount: '31.00',
      });
      expect(bookingsRepo.cancelMatchForTenant).toHaveBeenCalledWith({
        tenantId,
        matchId,
      });
      expect(emailService.sendMatchCancelledEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendMatchCancelledEmail).toHaveBeenCalledWith(
        'a@test.com',
      );
    });

    it('throws NotFoundException when match not found', async () => {
      bookingsRepo.cancelMatchForTenant.mockResolvedValue({
        success: false,
        code: 'MATCH_NOT_FOUND',
      });

      await expect(
        service.cancelMatchForTenant(tenantId, matchId),
      ).rejects.toThrow(NotFoundException);
      expect(emailService.sendMatchCancelledEmail).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when already cancelled', async () => {
      bookingsRepo.cancelMatchForTenant.mockResolvedValue({
        success: false,
        code: 'ALREADY_CANCELLED',
      });

      await expect(
        service.cancelMatchForTenant(tenantId, matchId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWaitlistForMatch', () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440002';

    it('returns FIFO-ordered waitlist entries for a match', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(matchRow);
      matchesRepo.findWaitlistForMatch.mockResolvedValue([
        {
          booking_id: 'b1',
          user_id: 'u1',
          name: 'Alice',
          photo_url: null,
          email: 'alice@test.com',
          position: 'field_player',
          paid_amount: '15.50',
          created_at: new Date('2026-06-01T10:00:00.000Z'),
          queue_position: 1,
        },
        {
          booking_id: 'b2',
          user_id: 'u2',
          name: 'Bob',
          photo_url: 'https://cdn.test/bob.jpg',
          email: 'bob@test.com',
          position: 'goalkeeper',
          paid_amount: '15.50',
          created_at: new Date('2026-06-01T11:00:00.000Z'),
          queue_position: 2,
        },
      ]);

      const result = await service.getWaitlistForMatch(tenantId, matchId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        bookingId: 'b1',
        userId: 'u1',
        name: 'Alice',
        photoUrl: null,
        email: 'alice@test.com',
        position: 'field_player',
        paidAmount: '15.50',
        queuePosition: 1,
        joinedAt: '2026-06-01T10:00:00.000Z',
      });
      expect(result[1]?.queuePosition).toBe(2);
    });

    it('throws NotFoundException when match not found', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(null);

      await expect(
        service.getWaitlistForMatch(tenantId, matchId),
      ).rejects.toThrow(NotFoundException);
      expect(matchesRepo.findWaitlistForMatch).not.toHaveBeenCalled();
    });

    it('returns empty array when no waitlist entries', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(matchRow);
      matchesRepo.findWaitlistForMatch.mockResolvedValue([]);

      const result = await service.getWaitlistForMatch(tenantId, matchId);
      expect(result).toEqual([]);
    });
  });

  describe('removeFromWaitlist', () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440002';
    const bookingId = 'bb0e8400-e29b-41d4-a716-446655440099';

    it('removes entry, returns refundAmount, and sends cancel email', async () => {
      bookingsRepo.removeFromWaitlistForTenant.mockResolvedValue({
        success: true,
        refundAmount: '15.50',
        playerEmail: 'player@test.com',
      });

      const result = await service.removeFromWaitlist({
        tenantId,
        matchId,
        bookingId,
      });

      expect(result).toEqual({ removed: true, refundAmount: '15.50' });
      expect(emailService.sendBookingCancelledEmail).toHaveBeenCalledWith(
        'player@test.com',
      );
    });

    it('throws NotFoundException when booking not found', async () => {
      bookingsRepo.removeFromWaitlistForTenant.mockResolvedValue({
        success: false,
        code: 'BOOKING_NOT_FOUND',
      });

      await expect(
        service.removeFromWaitlist({ tenantId, matchId, bookingId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when booking is not pending', async () => {
      bookingsRepo.removeFromWaitlistForTenant.mockResolvedValue({
        success: false,
        code: 'NOT_PENDING',
      });

      await expect(
        service.removeFromWaitlist({ tenantId, matchId, bookingId }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
