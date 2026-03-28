import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import type { VenueBrowseItemDto } from './dto/venue-browse-item.dto';
import type { VenueResponseDto } from './dto/venue-response.dto';
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
