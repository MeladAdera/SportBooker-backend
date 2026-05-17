import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { EmailService } from '../auth/email.service';
import { BookingPosition } from '../bookings/booking-position';
import { BookingsRepository } from '../bookings/bookings.repository';
import { BookingsService } from '../bookings/bookings.service';
import { VenueSportType } from '../venues/venue-sport-type';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { VenuesRepository } from '../venues/venues.repository';
import { MatchSide } from './dto/submit-match-results.dto';
import { MatchSortBy } from './match-sort-by';

describe('MatchesService', () => {
  let service: MatchesService;
  let matchesRepo: jest.Mocked<
    Pick<
      MatchesRepository,
      | 'countConfirmedBookingsForMatch'
      | 'countUpcomingMatchesForBrowse'
      | 'findMatchDetailForTenant'
      | 'findMatchResult'
      | 'findMatchRowForTenant'
      | 'findConfirmedPlayerIdsForMatch'
      | 'findUpcomingMatchesForBrowse'
      | 'findWaitlistForMatch'
      | 'hasOverlappingMatchAtVenue'
      | 'insertMatch'
      | 'insertMatchResults'
      | 'patchMatchForTenant'
      | 'clearFakeBookingsForMatch'
    >
  > & { withTransaction: jest.Mock };
  let venuesRepo: jest.Mocked<
    Pick<VenuesRepository, 'findVenueRowByIdForTenant'>
  >;
  let bookingsRepo: jest.Mocked<
    Pick<
      BookingsRepository,
      'cancelMatchForTenant' | 'removeFromWaitlistForTenant'
    >
  >;
  let bookingsServiceMock: jest.Mocked<
    Pick<BookingsService, 'promoteWaitlistAfterSpotOpened'>
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
    is_fake: false,
    min_real_spots: 0,
    created_at: new Date('2026-01-01T12:00:00.000Z'),
    updated_at: new Date('2026-01-01T12:00:00.000Z'),
  };

  const completedMatchRow = {
    ...{
      id: '770e8400-e29b-41d4-a716-446655440002',
      venue_id: venueId,
      title: 'Sunday league',
      sport_type: 'football',
      scheduled_at: new Date('2026-01-01T18:00:00.000Z'),
      duration_mins: 90,
      price_per_player: '15.50',
      status: 'completed',
      max_players: 22,
      is_fake: false,
      min_real_spots: 0,
      created_at: new Date('2026-01-01T12:00:00.000Z'),
      updated_at: new Date('2026-01-01T12:00:00.000Z'),
    },
  };

  const operatorId = 'aa0e8400-e29b-41d4-a716-446655440099';
  const player1Id = 'bb0e8400-e29b-41d4-a716-000000000001';
  const player2Id = 'bb0e8400-e29b-41d4-a716-000000000002';

  beforeEach(() => {
    matchesRepo = {
      countConfirmedBookingsForMatch: jest.fn(),
      countUpcomingMatchesForBrowse: jest.fn(),
      findMatchDetailForTenant: jest.fn(),
      findMatchResult: jest.fn(),
      findMatchRowForTenant: jest.fn(),
      findConfirmedPlayerIdsForMatch: jest.fn(),
      findUpcomingMatchesForBrowse: jest.fn(),
      findWaitlistForMatch: jest.fn().mockResolvedValue([]),
      hasOverlappingMatchAtVenue: jest.fn().mockResolvedValue(false),
      insertMatch: jest.fn(),
      insertMatchResults: jest.fn().mockResolvedValue(undefined),
      patchMatchForTenant: jest.fn(),
      clearFakeBookingsForMatch: jest.fn(),
      withTransaction: jest.fn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        async (fn: any) => fn({} as PoolClient),
      ),
    };
    venuesRepo = {
      findVenueRowByIdForTenant: jest.fn(),
    };
    bookingsRepo = {
      cancelMatchForTenant: jest.fn(),
      removeFromWaitlistForTenant: jest.fn(),
    };
    bookingsServiceMock = {
      promoteWaitlistAfterSpotOpened: jest.fn().mockResolvedValue(undefined),
    };
    emailService = {
      sendMatchCancelledEmail: jest.fn().mockResolvedValue(undefined),
      sendBookingCancelledEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new MatchesService(
      matchesRepo as unknown as MatchesRepository,
      venuesRepo as unknown as VenuesRepository,
      bookingsRepo as unknown as BookingsRepository,
      bookingsServiceMock as unknown as BookingsService,
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
        venue_picture_url: null,
        is_fake: false,
        spots_remaining: 20,
        waitlist_count: 2,
      },
    ]);

    const result = await service.listUpcomingForTenant(
      tenantId,
      {},
      'Asia/Dubai',
      'player',
    );

    expect(matchesRepo.countUpcomingMatchesForBrowse).toHaveBeenCalledWith({
      tenantId,
      sportType: null,
      venueId: null,
      date: null,
      available: null,
      timezone: 'Asia/Dubai',
      sortBy: null,
      dayOfWeek: null,
    });
    expect(matchesRepo.findUpcomingMatchesForBrowse).toHaveBeenCalledWith({
      tenantId,
      sportType: null,
      venueId: null,
      date: null,
      available: null,
      timezone: 'Asia/Dubai',
      sortBy: null,
      dayOfWeek: null,
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
      venuePictureUrl: '',
      spotsRemaining: 20,
      waitlistCount: 2,
      maxCapacity: 22,
      status: 'upcoming',
    });
  });

  it('forwards sortBy and dayOfWeek to repository', async () => {
    matchesRepo.countUpcomingMatchesForBrowse.mockResolvedValue(3);
    matchesRepo.findUpcomingMatchesForBrowse.mockResolvedValue([]);

    await service.listUpcomingForTenant(
      tenantId,
      { sortBy: MatchSortBy.PriceAsc, dayOfWeek: [6, 7] },
      'Asia/Dubai',
      'player',
    );

    expect(matchesRepo.countUpcomingMatchesForBrowse).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: MatchSortBy.PriceAsc,
        dayOfWeek: [6, 7],
      }),
    );
    expect(matchesRepo.findUpcomingMatchesForBrowse).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: MatchSortBy.PriceAsc,
        dayOfWeek: [6, 7],
      }),
    );
  });

  it('omits isFake on browse items for player role and includes it for tenant_admin', async () => {
    const fakeMatchRow = {
      id: '770e8400-e29b-41d4-a716-446655440099',
      title: 'Demo league',
      sport_type: 'football',
      scheduled_at: new Date('2026-06-01T18:00:00.000Z'),
      duration_mins: 90,
      price_per_player: '10.00',
      max_players: 22,
      status: 'upcoming',
      venue_name: 'Main Pitch',
      venue_picture_url: null,
      is_fake: true,
      spots_remaining: 20,
      waitlist_count: 0,
    };
    matchesRepo.countUpcomingMatchesForBrowse.mockResolvedValue(1);
    matchesRepo.findUpcomingMatchesForBrowse.mockResolvedValue([fakeMatchRow]);

    const playerResult = await service.listUpcomingForTenant(
      tenantId,
      {},
      'Asia/Dubai',
      'player',
    );
    expect(playerResult.items[0]).not.toHaveProperty('isFake');

    matchesRepo.findUpcomingMatchesForBrowse.mockResolvedValue([fakeMatchRow]);
    const adminResult = await service.listUpcomingForTenant(
      tenantId,
      {},
      'Asia/Dubai',
      'tenant_admin',
    );
    expect(adminResult.items[0].isFake).toBe(true);
  });

  it('omits isFake / minRealSpots / fakeBookingsCount on detail for player role and includes them for staff', async () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440098';
    const detailRow = {
      id: matchId,
      venue_id: venueId,
      venue_name: 'Main Pitch',
      venue_address: '1 Example Rd',
      venue_picture_url: 'https://cdn.example.com/venue.jpg',
      title: 'Demo Cup',
      sport_type: 'football',
      scheduled_at: new Date('2026-07-01T12:00:00.000Z'),
      duration_mins: 60,
      price_per_player: '12.00',
      status: 'upcoming',
      max_players: 10,
      is_fake: true,
      min_real_spots: 4,
      fake_bookings_count: 3,
      created_at: new Date(),
      updated_at: new Date(),
      spots_remaining: 4,
      roster: [],
      waitlist: [],
      waitlist_count: 0,
    };
    matchesRepo.findMatchDetailForTenant.mockResolvedValue(detailRow);
    const playerResult = await service.getDetailForTenant(
      tenantId,
      matchId,
      'player',
    );
    expect(playerResult).not.toHaveProperty('isFake');
    expect(playerResult).not.toHaveProperty('minRealSpots');
    expect(playerResult).not.toHaveProperty('fakeBookingsCount');

    matchesRepo.findMatchDetailForTenant.mockResolvedValue(detailRow);
    const staffResult = await service.getDetailForTenant(
      tenantId,
      matchId,
      'tenant_staff',
    );
    expect(staffResult.isFake).toBe(true);
    expect(staffResult.minRealSpots).toBe(4);
    expect(staffResult.fakeBookingsCount).toBe(3);
  });

  it('trims extra fakes from the roster for players so roster.length + spotsRemaining = maxCapacity', async () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440097';
    const reals = [
      {
        userId: 'r1',
        name: 'Andy Cole',
        position: BookingPosition.FieldPlayer,
        photoUrl: null,
        isFake: false,
        joinedAt: '2026-06-01T10:00:00.000Z',
      },
      {
        userId: 'r2',
        name: 'Peter Schmeichel',
        position: BookingPosition.FieldPlayer,
        photoUrl: null,
        isFake: false,
        joinedAt: '2026-06-01T10:05:00.000Z',
      },
    ];
    const fakes = Array.from({ length: 11 }, (_, i) => ({
      userId: `f${i + 1}`,
      name: `Demo Fake ${String(i + 1).padStart(2, '0')}`,
      position: BookingPosition.FieldPlayer,
      photoUrl: null,
      isFake: true,
      joinedAt: `2026-05-01T10:${String(i).padStart(2, '0')}:00.000Z`,
    }));
    const detailRow = {
      id: matchId,
      venue_id: venueId,
      venue_name: 'Main Pitch',
      venue_address: '1 Example Rd',
      venue_picture_url: '',
      title: 'Demo league',
      sport_type: 'football',
      scheduled_at: new Date('2026-07-01T12:00:00.000Z'),
      duration_mins: 60,
      price_per_player: '10.00',
      status: 'upcoming',
      max_players: 14,
      is_fake: true,
      min_real_spots: 2,
      fake_bookings_count: 11,
      created_at: new Date(),
      updated_at: new Date(),
      spots_remaining: 2,
      roster: [...reals, ...fakes],
      waitlist: [],
      waitlist_count: 0,
    };

    matchesRepo.findMatchDetailForTenant.mockResolvedValue(detailRow);
    const playerResult = await service.getDetailForTenant(
      tenantId,
      matchId,
      'player',
    );
    expect(playerResult.maxCapacity).toBe(14);
    expect(playerResult.spotsRemaining).toBe(2);
    expect(playerResult.roster).toHaveLength(12);
    expect(
      playerResult.roster.filter((p) => p.name.startsWith('Demo Fake')),
    ).toHaveLength(10);
    expect(
      playerResult.roster.find((p) => p.name === 'Demo Fake 11'),
    ).toBeUndefined();

    matchesRepo.findMatchDetailForTenant.mockResolvedValue(detailRow);
    const adminResult = await service.getDetailForTenant(
      tenantId,
      matchId,
      'tenant_admin',
    );
    expect(adminResult.roster).toHaveLength(13);
  });

  it('coerces empty dayOfWeek array to null', async () => {
    matchesRepo.countUpcomingMatchesForBrowse.mockResolvedValue(0);
    matchesRepo.findUpcomingMatchesForBrowse.mockResolvedValue([]);

    await service.listUpcomingForTenant(
      tenantId,
      { dayOfWeek: [] },
      'Asia/Dubai',
      'player',
    );

    expect(matchesRepo.countUpcomingMatchesForBrowse).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfWeek: null }),
    );
    expect(matchesRepo.findUpcomingMatchesForBrowse).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfWeek: null }),
    );
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
      is_fake: false,
      min_real_spots: 0,
      fake_bookings_count: 0,
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

    const result = await service.getDetailForTenant(
      tenantId,
      matchId,
      'player',
    );

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
        'player',
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
      isFake: false,
      minRealSpots: 0,
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

    it('throws BadRequestException when match is completed', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue({
        ...matchRow,
        status: 'completed',
      });

      await expect(
        service.updateForTenant(tenantId, matchId, { title: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(matchesRepo.patchMatchForTenant).not.toHaveBeenCalled();
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

    it('throws BadRequestException when match has already ended', async () => {
      bookingsRepo.cancelMatchForTenant.mockResolvedValue({
        success: false,
        code: 'MATCH_ALREADY_ENDED',
      });

      await expect(
        service.cancelMatchForTenant(tenantId, matchId),
      ).rejects.toThrow(BadRequestException);
      expect(emailService.sendMatchCancelledEmail).not.toHaveBeenCalled();
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

  describe('submitMatchResults', () => {
    const matchId = completedMatchRow.id;

    const baseResultRow = {
      match_id: matchId,
      winning_side: 'team_a',
      submitted_by: operatorId,
      created_at: new Date('2026-01-01T20:00:00.000Z'),
      players: [
        {
          userId: player1Id,
          teamSide: 'team_a',
          goals: 2,
          assists: 1,
          isMvp: true,
        },
        {
          userId: player2Id,
          teamSide: 'team_b',
          goals: 0,
          assists: 0,
          isMvp: false,
        },
      ],
    };

    it('submits results for a completed match and returns response', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findConfirmedPlayerIdsForMatch.mockResolvedValue([
        player1Id,
        player2Id,
      ]);
      matchesRepo.findMatchResult.mockResolvedValue(baseResultRow);

      const dto = {
        winningSide: MatchSide.TeamA,
        players: [
          {
            userId: player1Id,
            teamSide: MatchSide.TeamA,
            goals: 2,
            assists: 1,
            isMvp: true,
          },
          {
            userId: player2Id,
            teamSide: MatchSide.TeamB,
            goals: 0,
            assists: 0,
            isMvp: false,
          },
        ],
      };

      const result = await service.submitMatchResults(
        tenantId,
        matchId,
        dto,
        operatorId,
      );

      expect(matchesRepo.withTransaction).toHaveBeenCalled();
      expect(matchesRepo.insertMatchResults).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          matchId,
          winningSide: MatchSide.TeamA,
          submittedBy: operatorId,
        }),
      );
      expect(result.matchId).toBe(matchId);
      expect(result.winningSide).toBe('team_a');
      expect(result.players).toHaveLength(2);
      expect(result.players[0]).toMatchObject({
        userId: player1Id,
        isMvp: true,
        goals: 2,
      });
    });

    it('submits results as draw when winningSide is omitted', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findConfirmedPlayerIdsForMatch.mockResolvedValue([player1Id]);
      matchesRepo.findMatchResult.mockResolvedValue({
        ...baseResultRow,
        winning_side: null,
        players: [
          {
            userId: player1Id,
            teamSide: 'team_a',
            goals: 1,
            assists: 0,
            isMvp: false,
          },
        ],
      });

      const result = await service.submitMatchResults(
        tenantId,
        matchId,
        { players: [{ userId: player1Id, teamSide: MatchSide.TeamA }] },
        operatorId,
      );

      expect(matchesRepo.insertMatchResults).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ winningSide: null }),
      );
      expect(result.winningSide).toBeNull();
    });

    it('throws NotFoundException when match not found', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(null);

      await expect(
        service.submitMatchResults(
          tenantId,
          matchId,
          { players: [] },
          operatorId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(matchesRepo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when match is not completed', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue({
        ...completedMatchRow,
        status: 'upcoming',
      });

      await expect(
        service.submitMatchResults(
          tenantId,
          matchId,
          { players: [{ userId: player1Id, teamSide: MatchSide.TeamA }] },
          operatorId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(matchesRepo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when more than one MVP is set', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findConfirmedPlayerIdsForMatch.mockResolvedValue([
        player1Id,
        player2Id,
      ]);

      await expect(
        service.submitMatchResults(
          tenantId,
          matchId,
          {
            players: [
              { userId: player1Id, teamSide: MatchSide.TeamA, isMvp: true },
              { userId: player2Id, teamSide: MatchSide.TeamB, isMvp: true },
            ],
          },
          operatorId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(matchesRepo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a player has no confirmed booking', async () => {
      const unknownId = 'cc000000-e29b-41d4-a716-000000000099';
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findConfirmedPlayerIdsForMatch.mockResolvedValue([player1Id]);

      await expect(
        service.submitMatchResults(
          tenantId,
          matchId,
          { players: [{ userId: unknownId, teamSide: MatchSide.TeamA }] },
          operatorId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(matchesRepo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when results already submitted (PG unique violation)', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findConfirmedPlayerIdsForMatch.mockResolvedValue([player1Id]);
      matchesRepo.withTransaction.mockRejectedValue({ code: '23505' });

      await expect(
        service.submitMatchResults(
          tenantId,
          matchId,
          { players: [{ userId: player1Id, teamSide: MatchSide.TeamA }] },
          operatorId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getMatchResults', () => {
    const matchId = completedMatchRow.id;

    it('returns submitted results for a completed match', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findMatchResult.mockResolvedValue({
        match_id: matchId,
        winning_side: 'team_b',
        submitted_by: operatorId,
        created_at: new Date('2026-01-01T20:00:00.000Z'),
        players: [
          {
            userId: player1Id,
            teamSide: 'team_a',
            goals: 0,
            assists: 1,
            isMvp: false,
          },
          {
            userId: player2Id,
            teamSide: 'team_b',
            goals: 1,
            assists: 0,
            isMvp: true,
          },
        ],
      });

      const result = await service.getMatchResults(tenantId, matchId);

      expect(result.matchId).toBe(matchId);
      expect(result.winningSide).toBe('team_b');
      expect(result.players).toHaveLength(2);
    });

    it('throws NotFoundException when match not found', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(null);

      await expect(service.getMatchResults(tenantId, matchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when results not yet submitted', async () => {
      matchesRepo.findMatchRowForTenant.mockResolvedValue(completedMatchRow);
      matchesRepo.findMatchResult.mockResolvedValue(null);

      await expect(service.getMatchResults(tenantId, matchId)).rejects.toThrow(
        NotFoundException,
      );
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

  describe('clearFakesForMatch', () => {
    const matchId = '770e8400-e29b-41d4-a716-446655440300';

    it('returns summary and fires one waitlist promotion per removed fake', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: true,
        removed: 3,
        confirmedCount: 7,
        fakeBookingsCount: 0,
        spotsRemaining: 3,
      });

      const result = await service.clearFakesForMatch({ tenantId, matchId });

      expect(matchesRepo.clearFakeBookingsForMatch).toHaveBeenCalledWith({
        tenantId,
        matchId,
      });
      expect(result).toEqual({
        removed: 3,
        confirmedCount: 7,
        fakeBookingsCount: 0,
        spotsRemaining: 3,
      });
      // Allow the fire-and-forget promotion calls to settle.
      await Promise.resolve();
      expect(
        bookingsServiceMock.promoteWaitlistAfterSpotOpened,
      ).toHaveBeenCalledTimes(3);
      expect(
        bookingsServiceMock.promoteWaitlistAfterSpotOpened,
      ).toHaveBeenCalledWith(tenantId, matchId);
    });

    it('skips waitlist promotion when nothing was removed', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: true,
        removed: 0,
        confirmedCount: 5,
        fakeBookingsCount: 0,
        spotsRemaining: 5,
      });

      const result = await service.clearFakesForMatch({ tenantId, matchId });

      expect(result.removed).toBe(0);
      expect(
        bookingsServiceMock.promoteWaitlistAfterSpotOpened,
      ).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when match not found', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: false,
        code: 'MATCH_NOT_FOUND',
      });

      await expect(
        service.clearFakesForMatch({ tenantId, matchId }),
      ).rejects.toThrow(NotFoundException);
      expect(
        bookingsServiceMock.promoteWaitlistAfterSpotOpened,
      ).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when match is not fake', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: false,
        code: 'MATCH_NOT_FAKE',
      });

      await expect(
        service.clearFakesForMatch({ tenantId, matchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when match is cancelled or past', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: false,
        code: 'MATCH_NOT_UPCOMING',
      });

      await expect(
        service.clearFakesForMatch({ tenantId, matchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('swallows errors thrown by waitlist promotion (fire-and-forget)', async () => {
      matchesRepo.clearFakeBookingsForMatch.mockResolvedValue({
        success: true,
        removed: 2,
        confirmedCount: 8,
        fakeBookingsCount: 0,
        spotsRemaining: 2,
      });
      bookingsServiceMock.promoteWaitlistAfterSpotOpened.mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        service.clearFakesForMatch({ tenantId, matchId }),
      ).resolves.toMatchObject({ removed: 2 });
    });
  });
});
