import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';
import type { VenueBrowseItemDto } from './dto/venue-browse-item.dto';
import type { VenueDetailDto } from './dto/venue-detail.dto';
import type { VenueDeactivatedResponseDto } from './dto/venue-deactivated-response.dto';
import type { VenueResponseDto } from './dto/venue-response.dto';
import type { VenueSportType } from './venue-sport-type';
import { VenuesRepository, type VenueRow } from './venues.repository';
import { VenuePictureStorage } from './venue-picture.storage';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class VenuesService {
  constructor(
    private readonly venuesRepository: VenuesRepository,
    private readonly venuePictureStorage: VenuePictureStorage,
  ) {}

  async listForBrowse(
    tenantId: string,
    query: ListVenuesQueryDto,
  ): Promise<VenueBrowseItemDto[]> {
    const rows = await this.venuesRepository.findActiveVenuesForBrowse(
      tenantId,
      query.sportType,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      mapsUrl: row.maps_url,
      sportTypes: row.sport_types as VenueBrowseItemDto['sportTypes'],
      isActive: row.is_active,
    }));
  }

  async getByIdForTenant(
    tenantId: string,
    venueId: string,
  ): Promise<VenueDetailDto> {
    const row = await this.venuesRepository.findActiveVenueByIdForTenant(
      venueId,
      tenantId,
    );
    if (!row) {
      throw new NotFoundException('Venue not found');
    }
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      mapsUrl: row.maps_url,
      sportTypes: row.sport_types as VenueDetailDto['sportTypes'],
      isActive: row.is_active,
      pictureUrl: row.picture_url,
    };
  }

  async updateForTenant(
    tenantId: string,
    venueId: string,
    dto: UpdateVenueDto,
  ): Promise<VenueResponseDto> {
    if (!this.hasPatchFields(dto)) {
      throw new BadRequestException('At least one field must be provided');
    }
    const patch = this.buildVenuePatch(dto);
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
    const existing = await this.venuesRepository.findVenueRowByIdForTenant(
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
    const blocking =
      await this.venuesRepository.countBlockingMatchesForVenue(venueId);
    if (blocking > 0) {
      throw new ConflictException({
        message: `Cannot deactivate venue with ${blocking} upcoming or ongoing match(es)`,
        affectedMatches: blocking,
      });
    }
    const row = await this.venuesRepository.deactivateVenueForTenant(
      tenantId,
      venueId,
    );
    if (!row) {
      throw new NotFoundException('Venue not found');
    }
    return {
      message: 'Venue deactivated',
      venueId: row.id,
    };
  }

  private hasPatchFields(dto: UpdateVenueDto): boolean {
    return (
      dto.name !== undefined ||
      dto.address !== undefined ||
      dto.mapsUrl !== undefined ||
      dto.pictureUrl !== undefined ||
      dto.sportTypes !== undefined ||
      dto.isActive !== undefined
    );
  }

  private buildVenuePatch(dto: UpdateVenueDto): {
    name?: string;
    address?: string;
    mapsUrl?: string;
    pictureUrl?: string | null;
    sportTypes?: VenueSportType[];
    isActive?: boolean;
  } {
    const patch: {
      name?: string;
      address?: string;
      mapsUrl?: string;
      pictureUrl?: string | null;
      sportTypes?: VenueSportType[];
      isActive?: boolean;
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
    if (dto.pictureUrl !== undefined) {
      if (dto.pictureUrl === null) {
        patch.pictureUrl = null;
      } else {
        const t = dto.pictureUrl.trim();
        patch.pictureUrl = t.length > 0 ? t : null;
      }
    }
    if (dto.sportTypes !== undefined) {
      patch.sportTypes = dto.sportTypes;
    }
    if (dto.isActive !== undefined) {
      patch.isActive = dto.isActive;
    }
    return patch;
  }

  async create(
    tenantId: string,
    dto: CreateVenueDto,
    pictureFile?: Express.Multer.File,
  ): Promise<VenueResponseDto> {
    const trimmedPictureUrl = dto.pictureUrl?.trim();
    if (pictureFile && trimmedPictureUrl) {
      throw new BadRequestException(
        'Provide either a picture file (multipart) or pictureUrl, not both',
      );
    }
    try {
      let pictureUrl: string | null =
        trimmedPictureUrl && trimmedPictureUrl.length > 0
          ? trimmedPictureUrl
          : null;
      if (pictureFile) {
        pictureUrl = await this.venuePictureStorage.saveVenuePicture(
          tenantId,
          pictureFile,
        );
      }
      const row = await this.venuesRepository.insertVenue(tenantId, {
        name: dto.name.trim(),
        address: dto.address.trim(),
        mapsUrl: dto.mapsUrl,
        pictureUrl,
        sportTypes: dto.sportTypes,
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
      pictureUrl: row.picture_url,
      sportTypes: row.sport_types as VenueResponseDto['sportTypes'],
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
