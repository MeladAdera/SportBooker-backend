import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import { BookingPosition } from '../bookings/booking-position';
import { BookingsRepository } from '../bookings/bookings.repository';
import { BookingsService } from '../bookings/bookings.service';
import type { RemoveFromWaitlistResponseDto } from '../bookings/dto/remove-from-waitlist-response.dto';
import type { AutoFillFakeMatchResponseDto } from './dto/auto-fill-fake-match-response.dto';
import type { ClearFakesResponseDto } from './dto/clear-fakes-response.dto';
import type { CreateMatchDto } from './dto/create-match.dto';
import type { CancelMatchResponseDto } from './dto/cancel-match-response.dto';
import type { UpdateMatchDto } from './dto/update-match.dto';
import type { MatchBrowseItemDto } from './dto/match-browse-item.dto';
import type { MatchDetailResponseDto } from './dto/match-detail-response.dto';
import type {
  MatchResultsResponseDto,
  PlayerStatItemDto,
} from './dto/match-results-response.dto';
import type { MatchRosterPlayerDto } from './dto/match-roster-player.dto';
import type { MatchWaitlistPlayerDto } from './dto/match-waitlist-player.dto';
import type { OperatorWaitlistEntryDto } from './dto/operator-waitlist-entry.dto';
import type { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import type { ListTenantMatchesQueryDto } from './dto/list-tenant-matches-query.dto';
import type { OperatorMatchItemDto } from './dto/operator-match-item.dto';
import type { PaginatedOperatorMatchesDto } from './dto/paginated-operator-matches.dto';
import type { MatchResponseDto } from './dto/match-response.dto';
import type { PaginatedMatchesListDto } from './dto/paginated-matches-list.dto';
import {
  MatchSide,
  type SubmitMatchResultsDto,
} from './dto/submit-match-results.dto';
import {
  MatchesRepository,
  type MatchBrowseRow,
  type MatchDetailRow,
  type MatchOperatorRow,
  type MatchResultRow,
  type MatchRow,
  type WaitlistEntryRow,
} from './matches.repository';
import { VenuesRepository } from '../venues/venues.repository';
import type { VenueSportType } from '../venues/venue-sport-type';
import { UserRole } from '../users/user-role';

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Internal roster shape parsed from the repo JSON. Carries `isFake` and
 * `joinedAt` for fake-roster trimming; these are stripped before the DTO is
 * returned to any caller.
 */
type MatchRosterPlayerDtoInternal = MatchRosterPlayerDto & {
  isFake: boolean;
  joinedAt: string;
};

/**
 * Roles allowed to see fake-match metadata (`isFake`, `minRealSpots`,
 * `fakeBookingsCount`). Players never see these so demo matches stay
 * indistinguishable from real ones.
 */
const OPERATOR_ROLES: ReadonlySet<string> = new Set<string>([
  UserRole.SuperAdmin,
  UserRole.PlatformAdmin,
  UserRole.TenantAdmin,
  UserRole.TenantStaff,
]);

function isOperator(role: string | null | undefined): boolean {
  return role != null && OPERATOR_ROLES.has(role);
}

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService,
  ) {}

  async getDetailForTenant(
    tenantId: string,
    matchId: string,
    actorRole: string,
  ): Promise<MatchDetailResponseDto> {
    const row = await this.matchesRepository.findMatchDetailForTenant(
      matchId,
      tenantId,
    );
    if (!row) {
      throw new NotFoundException('Match not found');
    }
    return this.toDetailDto(row, actorRole);
  }

  async listUpcomingForTenant(
    tenantId: string,
    query: ListMatchesQueryDto,
    timezone: string,
    actorRole: string,
  ): Promise<PaginatedMatchesListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter = {
      tenantId,
      sportType: query.sportType ?? null,
      venueId: query.venueId ?? null,
      date: query.date ?? null,
      available: query.available ?? null,
      timezone,
      sortBy: query.sortBy ?? null,
      dayOfWeek:
        query.dayOfWeek && query.dayOfWeek.length > 0 ? query.dayOfWeek : null,
    };

    const [total, rows] = await Promise.all([
      this.matchesRepository.countUpcomingMatchesForBrowse(filter),
      this.matchesRepository.findUpcomingMatchesForBrowse({
        ...filter,
        limit,
        offset,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((row) => this.toBrowseItemDto(row, actorRole)),
    };
  }

  async listForOperator(
    tenantId: string,
    query: ListTenantMatchesQueryDto,
    timezone: string,
  ): Promise<PaginatedOperatorMatchesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter = {
      tenantId,
      status: query.status ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      venueId: query.venueId ?? null,
      sportType: query.sportType ?? null,
      search: query.search ?? null,
      timezone,
    };

    const [total, rows] = await Promise.all([
      this.matchesRepository.countMatchesForOperator(filter),
      this.matchesRepository.findMatchesForOperator({
        ...filter,
        limit,
        offset,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((row) => this.toOperatorItemDto(row)),
    };
  }

  async updateForTenant(
    tenantId: string,
    matchId: string,
    dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    if (!this.hasMatchPatchFields(dto)) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.matchesRepository.findMatchRowForTenant(
      matchId,
      tenantId,
    );
    if (!existing) {
      throw new NotFoundException('Match not found');
    }
    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cannot update a cancelled match');
    }
    if (existing.status === 'completed') {
      throw new BadRequestException(
        'Cannot update a match that has already ended',
      );
    }

    const confirmed =
      await this.matchesRepository.countConfirmedBookingsForMatch(matchId);
    if (dto.maxCapacity !== undefined && dto.maxCapacity < confirmed) {
      throw new ConflictException(
        `Capacity cannot be lower than the number of confirmed bookings (${confirmed})`,
      );
    }

    if (dto.minRealSpots !== undefined) {
      if (!existing.is_fake) {
        throw new BadRequestException(
          'minRealSpots can only be set on fake matches',
        );
      }
      const effectiveMaxCapacity = dto.maxCapacity ?? existing.max_players ?? 0;
      if (dto.minRealSpots > effectiveMaxCapacity) {
        throw new BadRequestException('minRealSpots cannot exceed maxCapacity');
      }
    }

    let effectiveVenueId = existing.venue_id;
    if (dto.venueId !== undefined) {
      effectiveVenueId = dto.venueId;
      const venue = await this.venuesRepository.findVenueRowByIdForTenant(
        dto.venueId,
        tenantId,
      );
      if (!venue) {
        throw new NotFoundException('Venue not found');
      }
      if (!venue.is_active) {
        throw new BadRequestException('Venue is inactive');
      }
    }

    const effectiveScheduledAt =
      dto.scheduledAt !== undefined
        ? new Date(dto.scheduledAt)
        : existing.scheduled_at;
    const effectiveDurationMins =
      dto.durationMins !== undefined
        ? dto.durationMins
        : existing.duration_mins;

    const scheduleOrVenueChanged =
      dto.scheduledAt !== undefined ||
      dto.durationMins !== undefined ||
      dto.venueId !== undefined;

    if (scheduleOrVenueChanged) {
      const overlaps = await this.matchesRepository.hasOverlappingMatchAtVenue(
        effectiveVenueId,
        effectiveScheduledAt,
        effectiveDurationMins,
        matchId,
      );
      if (overlaps) {
        throw new ConflictException(
          'This venue already has a match that overlaps the requested time slot',
        );
      }
    }

    const patch: {
      title?: string;
      sportType?: string;
      venueId?: string;
      scheduledAt?: Date;
      durationMins?: number;
      maxPlayers?: number;
      pricePerPlayer?: number;
      minRealSpots?: number;
    } = {};
    if (dto.title !== undefined) {
      patch.title = dto.title.trim();
    }
    if (dto.sportType !== undefined) {
      patch.sportType = dto.sportType;
    }
    if (dto.venueId !== undefined) {
      patch.venueId = dto.venueId;
    }
    if (dto.scheduledAt !== undefined) {
      patch.scheduledAt = new Date(dto.scheduledAt);
    }
    if (dto.durationMins !== undefined) {
      patch.durationMins = dto.durationMins;
    }
    if (dto.maxCapacity !== undefined) {
      patch.maxPlayers = dto.maxCapacity;
    }
    if (dto.pricePerPlayer !== undefined) {
      patch.pricePerPlayer = dto.pricePerPlayer;
    }
    if (dto.minRealSpots !== undefined) {
      patch.minRealSpots = dto.minRealSpots;
    }

    try {
      const row = await this.matchesRepository.patchMatchForTenant(
        tenantId,
        matchId,
        patch,
      );
      if (!row) {
        throw new NotFoundException('Match not found');
      }
      return this.toResponseDto(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'A match already exists for this venue at the scheduled time',
        );
      }
      throw err;
    }
  }

  async createForTenant(
    tenantId: string,
    dto: CreateMatchDto,
  ): Promise<MatchResponseDto> {
    const venue = await this.venuesRepository.findVenueRowByIdForTenant(
      dto.venueId,
      tenantId,
    );
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    if (!venue.is_active) {
      throw new BadRequestException('Venue is inactive');
    }

    const isFake = dto.isFake === true;
    const minRealSpots = dto.minRealSpots ?? 0;
    if (!isFake && minRealSpots > 0) {
      throw new BadRequestException(
        'minRealSpots can only be set on fake matches',
      );
    }
    if (minRealSpots > dto.maxCapacity) {
      throw new BadRequestException('minRealSpots cannot exceed maxCapacity');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const overlaps = await this.matchesRepository.hasOverlappingMatchAtVenue(
      dto.venueId,
      scheduledAt,
      dto.durationMins,
    );
    if (overlaps) {
      throw new ConflictException(
        'This venue already has a match that overlaps the requested time slot',
      );
    }

    try {
      const row = await this.matchesRepository.insertMatch({
        venueId: dto.venueId,
        title: dto.title.trim(),
        sportType: dto.sportType,
        scheduledAt,
        durationMins: dto.durationMins,
        maxPlayers: dto.maxCapacity,
        pricePerPlayer: dto.pricePerPlayer,
        isFake,
        minRealSpots,
      });
      return this.toResponseDto(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'A match already exists for this venue at the scheduled time',
        );
      }
      throw err;
    }
  }

  async cancelMatchForTenant(
    tenantId: string,
    matchId: string,
  ): Promise<CancelMatchResponseDto> {
    const result = await this.bookingsRepository.cancelMatchForTenant({
      tenantId,
      matchId,
    });
    if (!result.success) {
      if (result.code === 'MATCH_NOT_FOUND') {
        throw new NotFoundException('Match not found');
      }
      if (result.code === 'MATCH_ALREADY_ENDED') {
        throw new BadRequestException(
          'Cannot cancel a match that has already ended',
        );
      }
      throw new BadRequestException('Match is already cancelled');
    }
    const uniqueEmails = [...new Set(result.emailsForMatchCancelled)];
    for (const email of uniqueEmails) {
      void this.emailService
        .sendMatchCancelledEmail(email)
        .catch((err: unknown) => {
          this.logger.warn(
            `sendMatchCancelledEmail failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }
    return {
      cancelledBookings: result.cancelledBookings,
      refundedAmount: result.refundedAmount,
    };
  }

  async autoFillFakeMatch(params: {
    tenantId: string;
    matchId: string;
    count: number | null;
  }): Promise<AutoFillFakeMatchResponseDto> {
    const result = await this.matchesRepository.autoFillFakeMatch(params);
    if (!result.success) {
      switch (result.code) {
        case 'MATCH_NOT_FOUND':
          throw new NotFoundException('Match not found');
        case 'MATCH_NOT_FAKE':
          throw new BadRequestException(
            'Auto-fill is only available for fake matches',
          );
        case 'MATCH_NOT_UPCOMING':
          throw new BadRequestException(
            'Auto-fill is only available for upcoming, non-cancelled matches',
          );
        case 'MATCH_FULL_FOR_FAKES':
          throw new ConflictException(
            'No room for additional fake players (capacity reached or fake quota exhausted)',
          );
      }
    }
    return {
      filled: result.filled,
      confirmedCount: result.confirmedCount,
      fakeBookingsCount: result.fakeBookingsCount,
      spotsRemaining: result.spotsRemaining,
    };
  }

  /**
   * Hard-deletes every confirmed fake booking on a fake match. After commit,
   * fires one waitlist-promotion pass per freed seat (fire-and-forget) so
   * pending real players are upgraded to `confirmed` FIFO. Promotion failures
   * are logged but never bubble up — the response reflects only the
   * synchronous delete outcome.
   */
  async clearFakesForMatch(params: {
    tenantId: string;
    matchId: string;
  }): Promise<ClearFakesResponseDto> {
    const result =
      await this.matchesRepository.clearFakeBookingsForMatch(params);
    if (!result.success) {
      switch (result.code) {
        case 'MATCH_NOT_FOUND':
          throw new NotFoundException('Match not found');
        case 'MATCH_NOT_FAKE':
          throw new BadRequestException(
            'Clear fakes is only available for fake matches',
          );
        case 'MATCH_NOT_UPCOMING':
          throw new BadRequestException(
            'Clear fakes is only available for upcoming, non-cancelled matches',
          );
      }
    }

    for (let i = 0; i < result.removed; i++) {
      void this.bookingsService
        .promoteWaitlistAfterSpotOpened(params.tenantId, params.matchId)
        .catch((err: unknown) => {
          this.logger.error(
            `promoteWaitlistAfterSpotOpened (clearFakes) rejected: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        });
    }

    return {
      removed: result.removed,
      confirmedCount: result.confirmedCount,
      fakeBookingsCount: result.fakeBookingsCount,
      spotsRemaining: result.spotsRemaining,
    };
  }

  async getWaitlistForMatch(
    tenantId: string,
    matchId: string,
  ): Promise<OperatorWaitlistEntryDto[]> {
    const match = await this.matchesRepository.findMatchRowForTenant(
      matchId,
      tenantId,
    );
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    const rows = await this.matchesRepository.findWaitlistForMatch(
      matchId,
      tenantId,
    );
    return rows.map((r) => this.toWaitlistEntryDto(r));
  }

  async removeFromWaitlist(params: {
    tenantId: string;
    matchId: string;
    bookingId: string;
  }): Promise<RemoveFromWaitlistResponseDto> {
    const result =
      await this.bookingsRepository.removeFromWaitlistForTenant(params);
    if (!result.success) {
      if (result.code === 'BOOKING_NOT_FOUND') {
        throw new NotFoundException('Waitlist entry not found');
      }
      throw new BadRequestException(
        'Booking is not on the waitlist (not pending)',
      );
    }

    void this.emailService
      .sendBookingCancelledEmail(result.playerEmail)
      .catch((err: unknown) => {
        this.logger.warn(
          `sendBookingCancelledEmail (admin waitlist kick) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return {
      removed: true,
      refundAmount: result.refundAmount,
    };
  }

  async submitMatchResults(
    tenantId: string,
    matchId: string,
    dto: SubmitMatchResultsDto,
    operatorId: string,
  ): Promise<MatchResultsResponseDto> {
    const match = await this.matchesRepository.findMatchRowForTenant(
      matchId,
      tenantId,
    );
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    if (match.status !== 'completed') {
      throw new BadRequestException(
        'Results can only be submitted for completed matches',
      );
    }

    const mvpEntries = dto.players.filter((p) => p.isMvp === true);
    if (mvpEntries.length > 1) {
      throw new BadRequestException(
        'At most one player can be awarded MVP per match',
      );
    }

    const confirmedIds =
      await this.matchesRepository.findConfirmedPlayerIdsForMatch(matchId);
    const confirmedSet = new Set(confirmedIds);
    const invalidIds = dto.players.filter((p) => !confirmedSet.has(p.userId));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `The following player IDs do not have a confirmed booking for this match: ${invalidIds.map((p) => p.userId).join(', ')}`,
      );
    }

    try {
      await this.matchesRepository.withTransaction(async (client) => {
        await this.matchesRepository.insertMatchResults(client, {
          matchId,
          winningSide: dto.winningSide ?? null,
          submittedBy: operatorId,
          players: dto.players,
        });
      });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'Results have already been submitted for this match',
        );
      }
      throw err;
    }

    const result = await this.matchesRepository.findMatchResult(matchId);
    if (!result) {
      throw new NotFoundException('Match result not found after insert');
    }
    return this.toMatchResultsDto(result);
  }

  async getMatchResults(
    tenantId: string,
    matchId: string,
  ): Promise<MatchResultsResponseDto> {
    const match = await this.matchesRepository.findMatchRowForTenant(
      matchId,
      tenantId,
    );
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const result = await this.matchesRepository.findMatchResult(matchId);
    if (!result) {
      throw new NotFoundException(
        'No results have been submitted for this match yet',
      );
    }
    return this.toMatchResultsDto(result);
  }

  private toMatchResultsDto(row: MatchResultRow): MatchResultsResponseDto {
    return {
      matchId: row.match_id,
      winningSide: row.winning_side as MatchSide | null,
      players: MatchesService.parseMatchResultPlayers(row.players),
      submittedBy: row.submitted_by,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private static parseMatchResultPlayers(raw: unknown): PlayerStatItemDto[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const r = item as {
        userId?: string;
        teamSide?: string;
        goals?: number;
        assists?: number;
        isMvp?: boolean;
      };
      return {
        userId: String(r.userId ?? ''),
        teamSide: (r.teamSide ?? MatchSide.TeamA) as MatchSide,
        goals: Number(r.goals ?? 0),
        assists: Number(r.assists ?? 0),
        isMvp: Boolean(r.isMvp ?? false),
      };
    });
  }

  private toDetailDto(
    row: MatchDetailRow,
    actorRole: string,
  ): MatchDetailResponseDto {
    const maxCapacity = row.max_players ?? 0;
    const spotsRemaining = Number(row.spots_remaining);
    const fullRoster = MatchesService.parseRoster(row.roster);
    const roster = isOperator(actorRole)
      ? fullRoster.map((r) => MatchesService.stripRosterInternalFields(r))
      : MatchesService.trimRosterForPlayer(
          fullRoster,
          maxCapacity,
          spotsRemaining,
        );

    const dto: MatchDetailResponseDto = {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      venueId: row.venue_id,
      venueName: row.venue_name,
      venueAddress: row.venue_address,
      venuePictureUrl: row.venue_picture_url,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      maxCapacity,
      pricePerPlayer: Number(row.price_per_player),
      status: row.status,
      spotsRemaining,
      roster,
      waitlist: MatchesService.parseWaitlist(row.waitlist),
      waitlistCount: Number(row.waitlist_count),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
    if (isOperator(actorRole)) {
      dto.isFake = row.is_fake;
      dto.minRealSpots = Number(row.min_real_spots);
      dto.fakeBookingsCount = Number(row.fake_bookings_count);
    }
    return dto;
  }

  /**
   * For player-facing roster display on fake matches, trim the fake tail so
   * that `roster.length + spotsRemaining === maxCapacity`. Real players are
   * always preserved; fakes are ordered oldest-first by the SQL so newer fakes
   * get dropped, keeping the match looking "long-established".
   */
  private static trimRosterForPlayer(
    roster: MatchRosterPlayerDtoInternal[],
    maxCapacity: number,
    spotsRemaining: number,
  ): MatchRosterPlayerDto[] {
    const targetSize = Math.max(0, maxCapacity - spotsRemaining);
    if (roster.length <= targetSize) {
      return roster.map((r) => MatchesService.stripRosterInternalFields(r));
    }
    const reals = roster.filter((r) => !r.isFake);
    const fakes = roster.filter((r) => r.isFake);
    const fakesToKeep = Math.max(0, targetSize - reals.length);
    return [...reals, ...fakes.slice(0, fakesToKeep)].map((r) =>
      MatchesService.stripRosterInternalFields(r),
    );
  }

  private static stripRosterInternalFields(
    this: void,
    r: MatchRosterPlayerDtoInternal,
  ): MatchRosterPlayerDto {
    return {
      userId: r.userId,
      name: r.name,
      position: r.position,
      photoUrl: r.photoUrl,
    };
  }

  private static parseRoster(raw: unknown): MatchRosterPlayerDtoInternal[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => {
      const r = item as {
        userId?: string;
        name?: string;
        position?: string;
        photoUrl?: string | null;
        isFake?: boolean;
        joinedAt?: string;
      };
      return {
        userId: String(r.userId ?? ''),
        name: String(r.name ?? ''),
        position: (r.position ??
          BookingPosition.FieldPlayer) as BookingPosition,
        photoUrl: r.photoUrl ?? null,
        isFake: Boolean(r.isFake ?? false),
        joinedAt: r.joinedAt ?? '',
      };
    });
  }

  static parseWaitlist(raw: unknown): MatchWaitlistPlayerDto[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => {
      const r = item as {
        userId?: string;
        name?: string;
        position?: string;
        photoUrl?: string | null;
        queuePosition?: number;
        joinedAt?: string;
      };
      return {
        userId: String(r.userId ?? ''),
        name: String(r.name ?? ''),
        position: (r.position ??
          BookingPosition.FieldPlayer) as BookingPosition,
        photoUrl: r.photoUrl ?? null,
        queuePosition: Number(r.queuePosition ?? 0),
        joinedAt: r.joinedAt ? new Date(r.joinedAt).toISOString() : '',
      };
    });
  }

  private toBrowseItemDto(
    row: MatchBrowseRow,
    actorRole: string,
  ): MatchBrowseItemDto {
    const dto: MatchBrowseItemDto = {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      pricePerPlayer: Number(row.price_per_player),
      maxCapacity: row.max_players ?? 0,
      spotsRemaining: Number(row.spots_remaining),
      waitlistCount: Number(row.waitlist_count),
      status: row.status,
      venueName: row.venue_name,
      venuePictureUrl: row.venue_picture_url ?? '',
    };
    if (isOperator(actorRole)) {
      dto.isFake = row.is_fake;
    }
    return dto;
  }

  private toOperatorItemDto(row: MatchOperatorRow): OperatorMatchItemDto {
    return {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      pricePerPlayer: Number(row.price_per_player),
      maxCapacity: row.max_players ?? 0,
      status: row.status,
      venueId: row.venue_id,
      venueName: row.venue_name,
      confirmedCount: row.confirmed_count,
      waitlistCount: row.waitlist_count,
      spotsRemaining: Number(row.spots_remaining),
      isFake: row.is_fake,
      minRealSpots: Number(row.min_real_spots),
      fakeBookingsCount: Number(row.fake_bookings_count),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private hasMatchPatchFields(dto: UpdateMatchDto): boolean {
    return (
      dto.title !== undefined ||
      dto.sportType !== undefined ||
      dto.venueId !== undefined ||
      dto.scheduledAt !== undefined ||
      dto.durationMins !== undefined ||
      dto.maxCapacity !== undefined ||
      dto.pricePerPlayer !== undefined ||
      dto.minRealSpots !== undefined
    );
  }

  private toResponseDto(row: MatchRow): MatchResponseDto {
    return {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      venueId: row.venue_id,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      maxCapacity: row.max_players ?? 0,
      pricePerPlayer: Number(row.price_per_player),
      status: row.status,
      isFake: row.is_fake,
      minRealSpots: Number(row.min_real_spots),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toWaitlistEntryDto(row: WaitlistEntryRow): OperatorWaitlistEntryDto {
    return {
      bookingId: row.booking_id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      photoUrl: row.photo_url,
      position: row.position as BookingPosition,
      paidAmount: row.paid_amount,
      queuePosition: Number(row.queue_position),
      joinedAt: row.created_at.toISOString(),
    };
  }
}
