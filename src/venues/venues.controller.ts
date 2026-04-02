import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Tenant } from '../common/tenant.types';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { CreateVenueMultipartDto } from './dto/create-venue-multipart.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueBrowseItemDto } from './dto/venue-browse-item.dto';
import { VenueDeactivatedResponseDto } from './dto/venue-deactivated-response.dto';
import { VenueDetailDto } from './dto/venue-detail.dto';
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
@UseGuards(TenantRequiredGuard, RolesGuard)
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
    @TenantDecorator() tenant: Tenant,
    @Query() query: ListVenuesQueryDto,
  ): Promise<VenueBrowseItemDto[]> {
    return this.venuesService.listForBrowse(tenant.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get venue details',
    description:
      'Any authenticated user. Returns one active venue for this tenant; 404 if missing, inactive, or not in this tenant.',
  })
  @ApiOkResponse({ type: VenueDetailDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getById(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VenueDetailDto> {
    return this.venuesService.getByIdForTenant(tenant.id, id);
  }

  @Patch(':id')
  @Roles(UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Update a venue (partial)',
    description:
      'Tenant staff only. Send only fields to change; `is_active` can be toggled. Venue must belong to this tenant.',
  })
  @ApiOkResponse({ type: VenueResponseDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async update(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
  ): Promise<VenueResponseDto> {
    return this.venuesService.updateForTenant(tenant.id, id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Deactivate a venue',
    description:
      'Tenant admin only. Sets is_active to false (no hard delete). Blocked with 409 if the venue has scheduled (upcoming) or in-progress matches.',
  })
  @ApiOkResponse({ type: VenueDeactivatedResponseDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiConflictResponse({
    description:
      'Venue has upcoming or ongoing matches; response body includes affectedMatches count',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({
    description: 'Insufficient role (tenant admin only)',
  })
  async deactivate(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VenueDeactivatedResponseDto> {
    return this.venuesService.deactivateForTenant(tenant.id, id);
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
    @TenantDecorator() tenant: Tenant,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueResponseDto> {
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
    @TenantDecorator() tenant: Tenant,
    @Body() body: CreateVenueMultipartDto,
    @UploadedFile() picture: Express.Multer.File | undefined,
  ): Promise<VenueResponseDto> {
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
