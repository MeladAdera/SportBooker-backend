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
import type { CreateMatchDto } from './dto/create-match.dto';
import type { CancelMatchResponseDto } from './dto/cancel-match-response.dto';
import type { UpdateMatchDto } from './dto/update-match.dto';
import type { MatchBrowseItemDto } from './dto/match-browse-item.dto';
import type { MatchDetailResponseDto } from './dto/match-detail-response.dto';
import type { MatchRosterPlayerDto } from './dto/match-roster-player.dto';
import type { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import type { MatchResponseDto } from './dto/match-response.dto';
import type { PaginatedMatchesListDto } from './dto/paginated-matches-list.dto';
import {
  MatchesRepository,
  type MatchBrowseRow,
  type MatchDetailRow,
  type MatchRow,
} from './matches.repository';
import { VenuesRepository } from '../venues/venues.repository';
import type { VenueSportType } from '../venues/venue-sport-type';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly emailService: EmailService,
  ) {}

  async getDetailForTenant(
    tenantId: string,
    matchId: string,
  ): Promise<MatchDetailResponseDto> {
    const row = await this.matchesRepository.findMatchDetailForTenant(
      matchId,
      tenantId,
    );
    if (!row) {
      throw new NotFoundException('Match not found');
    }
    return this.toDetailDto(row);
  }

  async listUpcomingForTenant(
    tenantId: string,
    query: ListMatchesQueryDto,
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
      items: rows.map((row) => this.toBrowseItemDto(row)),
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

    const confirmed =
      await this.matchesRepository.countConfirmedBookingsForMatch(matchId);
    if (dto.maxCapacity !== undefined && dto.maxCapacity < confirmed) {
      throw new ConflictException(
        `Capacity cannot be lower than the number of confirmed bookings (${confirmed})`,
      );
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

  private toDetailDto(row: MatchDetailRow): MatchDetailResponseDto {
    return {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      venueId: row.venue_id,
      venueName: row.venue_name,
      venueAddress: row.venue_address,
      venuePictureUrl: row.venue_picture_url,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      maxCapacity: row.max_players ?? 0,
      pricePerPlayer: Number(row.price_per_player),
      status: row.status,
      spotsRemaining: Number(row.spots_remaining),
      roster: MatchesService.parseRoster(row.roster),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private static parseRoster(raw: unknown): MatchRosterPlayerDto[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => {
      const r = item as {
        userId?: string;
        name?: string;
        position?: string;
        photoUrl?: string | null;
      };
      return {
        userId: String(r.userId ?? ''),
        name: String(r.name ?? ''),
        position: (r.position ??
          BookingPosition.FieldPlayer) as BookingPosition,
        photoUrl: r.photoUrl ?? null,
      };
    });
  }

  private toBrowseItemDto(row: MatchBrowseRow): MatchBrowseItemDto {
    return {
      id: row.id,
      title: row.title,
      sportType: row.sport_type as VenueSportType,
      scheduledAt: row.scheduled_at.toISOString(),
      durationMins: row.duration_mins,
      pricePerPlayer: Number(row.price_per_player),
      maxCapacity: row.max_players ?? 0,
      spotsRemaining: Number(row.spots_remaining),
      status: row.status,
      venueName: row.venue_name,
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
      dto.pricePerPlayer !== undefined
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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
