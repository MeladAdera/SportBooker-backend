import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateMatchDto } from './dto/create-match.dto';
import type { MatchBrowseItemDto } from './dto/match-browse-item.dto';
import type { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import type { MatchResponseDto } from './dto/match-response.dto';
import type { PaginatedMatchesListDto } from './dto/paginated-matches-list.dto';
import {
  MatchesRepository,
  type MatchBrowseRow,
  type MatchRow,
} from './matches.repository';
import { VenuesRepository } from '../venues/venues.repository';
import type { VenueSportType } from '../venues/venue-sport-type';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class MatchesService {
  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly venuesRepository: VenuesRepository,
  ) {}

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
