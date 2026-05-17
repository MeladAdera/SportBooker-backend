import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateVenueDto } from './dto/create-venue.dto';
import { parseSportTypesJson } from './parse-sport-types-json';
import type { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import type { PaginatedVenuesListDto } from './dto/paginated-venues-list.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';
import type { VenueBrowseItemDto } from './dto/venue-browse-item.dto';
import type { VenueDetailDto } from './dto/venue-detail.dto';
import type { VenueActivatedResponseDto } from './dto/venue-activated-response.dto';
import type { VenueDeactivatedResponseDto } from './dto/venue-deactivated-response.dto';
import type { VenueResponseDto } from './dto/venue-response.dto';
import { VenueSportType } from './venue-sport-type';
import { VenuesRepository, type VenueRow } from './venues.repository';
import { VenuePictureStorage } from './venue-picture.storage';

const PG_UNIQUE_VIOLATION = '23505';

const SPORT_DEFAULT_PICTURE_URLS: Partial<Record<VenueSportType, string>> = {
  [VenueSportType.Football]:
    'https://diamondfootball.com/news/birds-eye-view-of-a-football-pitch.jpg',
};

/** Returns the stored URL, falling back to a sport-specific default when null. */
function resolveVenuePictureUrl(
  pictureUrl: string | null,
  sportTypes: string[],
): string | null {
  console.log('pictureUrl', pictureUrl);
  if (pictureUrl !== null) return pictureUrl;
  for (const sport of sportTypes) {
    const defaultUrl =
      SPORT_DEFAULT_PICTURE_URLS[sport as VenueSportType] ?? null;
    if (defaultUrl) return defaultUrl;
  }
  return null;
}

/** Default page size for GET /venues (matches use 20). */
const DEFAULT_VENUE_LIST_LIMIT = 50;

@Injectable()
export class VenuesService {
  constructor(
    private readonly venuesRepository: VenuesRepository,
    private readonly venuePictureStorage: VenuePictureStorage,
  ) {}

  async listForBrowse(
    tenantId: string,
    query: ListVenuesQueryDto,
    includeInactive = false,
  ): Promise<PaginatedVenuesListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_VENUE_LIST_LIMIT;
    const offset = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.venuesRepository.countVenuesForBrowse(
        tenantId,
        query.sportType,
        includeInactive,
      ),
      this.venuesRepository.findVenuesForBrowse(
        tenantId,
        query.sportType,
        limit,
        offset,
        includeInactive,
      ),
    ]);

    const items: VenueBrowseItemDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      mapsUrl: row.maps_url,
      sportTypes: row.sport_types as VenueBrowseItemDto['sportTypes'],
      isActive: row.is_active,
    }));

    return { items, page, limit, total };
  }

  async getByIdForTenant(
    tenantId: string,
    venueId: string,
    includeInactive = false,
  ): Promise<VenueDetailDto> {
    const row = includeInactive
      ? await this.venuesRepository.findVenueRowByIdForTenant(venueId, tenantId)
      : await this.venuesRepository.findActiveVenueByIdForTenant(
          venueId,
          tenantId,
        );
    if (!row) {
      throw new NotFoundException('Venue not found');
    }
    return {
      id: row.id,
      name: row.name,
      // address and maps_url are required at creation and cannot be set to null
      address: row.address ?? '',
      mapsUrl: row.maps_url ?? '',
      sportTypes: row.sport_types as VenueDetailDto['sportTypes'],
      isActive: row.is_active,
      pictureUrl: resolveVenuePictureUrl(row.picture_url, row.sport_types),
    };
  }

  async updateForTenant(
    tenantId: string,
    venueId: string,
    dto: UpdateVenueDto,
    pictureFile?: Express.Multer.File,
  ): Promise<VenueResponseDto> {
    if (!this.hasPatchFields(dto, pictureFile)) {
      throw new BadRequestException('At least one field must be provided');
    }
    const patch = await this.buildVenuePatch(dto, tenantId, pictureFile);
    try {
      const row = await this.venuesRepository.patchVenueForTenant(
        tenantId,
        venueId,
        patch,
      );
      if (!row) {
        throw new NotFoundException('Venue not found');
      }
      return this.toResponseDto(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'A venue with this name already exists for this tenant',
        );
      }
      throw err;
    }
  }

  async deactivateForTenant(
    tenantId: string,
    venueId: string,
  ): Promise<VenueDeactivatedResponseDto> {
    let row =
      await this.venuesRepository.deactivateVenueForTenantIfNoBlockingMatches(
        tenantId,
        venueId,
      );
    if (row) {
      return {
        message: 'Venue deactivated',
        venueId: row.id,
      };
    }

    let existing = await this.venuesRepository.findVenueRowByIdForTenant(
      venueId,
      tenantId,
    );
    if (!existing) {
      throw new NotFoundException('Venue not found');
    }
    if (!existing.is_active) {
      return {
        message: 'Venue was already inactive',
        venueId: existing.id,
        alreadyInactive: true,
      };
    }

    let blocking =
      await this.venuesRepository.countBlockingMatchesForVenue(venueId);
    if (blocking > 0) {
      throw new ConflictException({
        message: `Cannot deactivate venue with ${blocking} upcoming or ongoing match(es)`,
        affectedMatches: blocking,
      });
    }

    row =
      await this.venuesRepository.deactivateVenueForTenantIfNoBlockingMatches(
        tenantId,
        venueId,
      );
    if (row) {
      return {
        message: 'Venue deactivated',
        venueId: row.id,
      };
    }

    existing = await this.venuesRepository.findVenueRowByIdForTenant(
      venueId,
      tenantId,
    );
    if (!existing) {
      throw new NotFoundException('Venue not found');
    }
    if (!existing.is_active) {
      return {
        message: 'Venue was already inactive',
        venueId: existing.id,
        alreadyInactive: true,
      };
    }

    blocking =
      await this.venuesRepository.countBlockingMatchesForVenue(venueId);
    if (blocking > 0) {
      throw new ConflictException({
        message: `Cannot deactivate venue with ${blocking} upcoming or ongoing match(es)`,
        affectedMatches: blocking,
      });
    }

    throw new ConflictException({
      message: 'Cannot deactivate venue; please retry',
      affectedMatches: 0,
    });
  }

  async activateForTenant(
    tenantId: string,
    venueId: string,
  ): Promise<VenueActivatedResponseDto> {
    const existing = await this.venuesRepository.findVenueRowByIdForTenant(
      venueId,
      tenantId,
    );
    if (!existing) {
      throw new NotFoundException('Venue not found');
    }
    if (existing.is_active) {
      return {
        message: 'Venue was already active',
        venueId: existing.id,
        alreadyActive: true,
      };
    }
    const row = await this.venuesRepository.activateVenueForTenant(
      tenantId,
      venueId,
    );
    if (!row) {
      throw new NotFoundException('Venue not found');
    }
    return {
      message: 'Venue activated',
      venueId: row.id,
    };
  }

  private hasPatchFields(
    dto: UpdateVenueDto,
    pictureFile?: Express.Multer.File,
  ): boolean {
    return (
      pictureFile !== undefined ||
      dto.name !== undefined ||
      dto.address !== undefined ||
      dto.mapsUrl !== undefined ||
      dto.pictureUrl !== undefined ||
      dto.sportTypes !== undefined
    );
  }

  private async buildVenuePatch(
    dto: UpdateVenueDto,
    tenantId: string,
    pictureFile?: Express.Multer.File,
  ): Promise<{
    name?: string;
    address?: string;
    mapsUrl?: string;
    pictureUrl?: string | null;
    sportTypes?: VenueSportType[];
  }> {
    const patch: {
      name?: string;
      address?: string;
      mapsUrl?: string;
      pictureUrl?: string | null;
      sportTypes?: VenueSportType[];
    } = {};
    if (dto.name !== undefined) {
      patch.name = dto.name.trim();
    }
    if (dto.address !== undefined) {
      patch.address = dto.address.trim();
    }
    if (dto.mapsUrl !== undefined) {
      patch.mapsUrl = dto.mapsUrl;
    }
    if (pictureFile) {
      patch.pictureUrl = await this.venuePictureStorage.saveVenuePicture(
        tenantId,
        pictureFile,
      );
    } else if (dto.pictureUrl !== undefined) {
      if (dto.pictureUrl === null) {
        patch.pictureUrl = null;
      } else {
        const t = dto.pictureUrl.trim();
        patch.pictureUrl = t.length > 0 ? t : null;
      }
    }
    if (dto.sportTypes !== undefined) {
      patch.sportTypes = parseSportTypesJson(dto.sportTypes);
    }
    return patch;
  }

  async create(
    tenantId: string,
    dto: CreateVenueDto,
    pictureFile?: Express.Multer.File,
  ): Promise<VenueResponseDto> {
    const sportTypes = parseSportTypesJson(dto.sportTypes);
    const trimmedPictureUrl = dto.pictureUrl?.trim();

    let pictureUrl: string | null = null;
    if (pictureFile) {
      pictureUrl = await this.venuePictureStorage.saveVenuePicture(
        tenantId,
        pictureFile,
      );
    } else if (trimmedPictureUrl && trimmedPictureUrl.length > 0) {
      pictureUrl = trimmedPictureUrl;
    } else {
      pictureUrl = resolveVenuePictureUrl(null, sportTypes);
      if (pictureUrl === null) {
        throw new BadRequestException(
          'Either a picture file or pictureUrl must be provided',
        );
      }
    }

    try {
      const row = await this.venuesRepository.insertVenue(tenantId, {
        name: dto.name.trim(),
        address: dto.address.trim(),
        mapsUrl: dto.mapsUrl,
        pictureUrl,
        sportTypes,
      });
      return this.toResponseDto(row);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'A venue with this name already exists for this tenant',
        );
      }
      throw err;
    }
  }

  private toResponseDto(row: VenueRow): VenueResponseDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      address: row.address,
      mapsUrl: row.maps_url,
      pictureUrl: resolveVenuePictureUrl(row.picture_url, row.sport_types),
      sportTypes: row.sport_types as VenueResponseDto['sportTypes'],
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
