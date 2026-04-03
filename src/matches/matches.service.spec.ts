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
      | 'hasOverlappingMatchAtVenue'
      | 'insertMatch'
      | 'patchMatchForTenant'
    >
  >;
  let venuesRepo: jest.Mocked<
    Pick<VenuesRepository, 'findVenueRowByIdForTenant'>
  >;
  let bookingsRepo: jest.Mocked<
    Pick<BookingsRepository, 'cancelMatchForTenant'>
  >;
  let emailService: jest.Mocked<Pick<EmailService, 'sendMatchCancelledEmail'>>;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const venueId = '660e8400-e29b-41d4-a716-446655440001';

  const matchRow = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    venue_id: venueId,
    title: 'Sunday league',
    sport_type: 'football',
    scheduled_at: new Date('2026-06-01T18:00:00.000Z'),
    duration_mins: 90,
    price_per_player: '15.50',
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
      hasOverlappingMatchAtVenue: jest.fn().mockResolvedValue(false),
      insertMatch: jest.fn(),
      patchMatchForTenant: jest.fn(),
    };
    venuesRepo = {
      findVenueRowByIdForTenant: jest.fn(),
    };
    bookingsRepo = {
      cancelMatchForTenant: jest.fn(),
    };
    emailService = {
      sendMatchCancelledEmail: jest.fn().mockResolvedValue(undefined),
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
    });

    const result = await service.getDetailForTenant(tenantId, matchId);

    expect(matchesRepo.findMatchDetailForTenant).toHaveBeenCalledWith(
      matchId,
      tenantId,
    );
    expect(result.spotsRemaining).toBe(8);
    expect(result.roster).toHaveLength(1);
    expect(result.roster[0]).toEqual({
      userId: playerId,
      name: 'Alex',
      position: BookingPosition.FieldPlayer,
      photoUrl: 'https://cdn.example.com/p.jpg',
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
    pricePerPlayer: 15.5,
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
      pricePerPlayer: 15.5,
    });
    expect(result).toMatchObject({
      id: matchRow.id,
      title: 'Sunday league',
      sportType: VenueSportType.Football,
      venueId,
      durationMins: 90,
      maxCapacity: 22,
      pricePerPlayer: 15.5,
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
});
