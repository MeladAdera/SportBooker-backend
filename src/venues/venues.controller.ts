import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Tenant } from '../common/tenant.types';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role';
import { CreateVenueMultipartDto } from './dto/create-venue-multipart.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { VenueBrowseItemDto } from './dto/venue-browse-item.dto';
import { VenueResponseDto } from './dto/venue-response.dto';
import { parseSportTypesJson } from './parse-sport-types-json';
import { VenuesService } from './venues.service';

const VENUE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

const venuePictureMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: VENUE_PICTURE_MAX_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (e: Error | null, accept: boolean) => void,
  ): void => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(null, ok);
  },
};

@ApiTags('Venues')
@ApiBearerAuth()
@Controller('venues')
@UseGuards(RolesGuard)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  @ApiOperation({
    summary: 'List active venues',
    description:
      'Any authenticated user in the tenant. Returns active venues only; optional sportType filters venues that offer that sport.',
  })
  @ApiOkResponse({ type: VenueBrowseItemDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async list(
    @TenantDecorator() tenant: Tenant | undefined,
    @Query() query: ListVenuesQueryDto,
  ): Promise<VenueBrowseItemDto[]> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.venuesService.listForBrowse(tenant.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Create a venue (JSON)',
    description:
      'Tenant staff only. Required: name, address, mapsUrl, sportTypes. Optional: pictureUrl (image link). For file upload use POST /venues/upload.',
  })
  @ApiCreatedResponse({ type: VenueResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async create(
    @TenantDecorator() tenant: Tenant | undefined,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.venuesService.create(tenant.id, dto);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.TenantAdmin, UserRole.TenantStaff)
  @UseInterceptors(FileInterceptor('picture', venuePictureMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'address', 'mapsUrl', 'sportTypes'],
      properties: {
        name: { type: 'string', example: 'North Court 1' },
        address: { type: 'string', example: '1 Stadium Rd' },
        mapsUrl: { type: 'string', example: 'https://maps.google.com/?q=...' },
        pictureUrl: {
          type: 'string',
          description:
            'Optional image URL if not sending a file. Omit both for no image.',
        },
        sportTypes: {
          type: 'string',
          description: 'JSON array, e.g. ["football","padel"]',
          example: '["football","padel"]',
        },
        picture: {
          type: 'string',
          format: 'binary',
          description: 'Optional image file (JPEG, PNG, WebP, GIF), max 5MB',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Create a venue with optional image file',
    description:
      'Same as POST /venues but accepts multipart/form-data. Send optional `picture` file from the device, or `pictureUrl` for a link — not both.',
  })
  @ApiCreatedResponse({ type: VenueResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async createWithUpload(
    @TenantDecorator() tenant: Tenant | undefined,
    @Body() body: CreateVenueMultipartDto,
    @UploadedFile() picture: Express.Multer.File | undefined,
  ): Promise<VenueResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    const sportTypes = parseSportTypesJson(body.sportTypes);
    const dto: CreateVenueDto = {
      name: body.name,
      address: body.address,
      mapsUrl: body.mapsUrl,
      pictureUrl: body.pictureUrl,
      sportTypes,
    };
    return this.venuesService.create(tenant.id, dto, picture);
  }
}
