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
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { PaginatedVenuesListDto } from './dto/paginated-venues-list.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueDeactivatedResponseDto } from './dto/venue-deactivated-response.dto';
import { VenueDetailDto } from './dto/venue-detail.dto';
import { VenueResponseDto } from './dto/venue-response.dto';
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
      'Any authenticated user in the tenant. Paginated active venues; default page 1, limit 50. Optional sportType filters venues that offer that sport.',
  })
  @ApiOkResponse({ type: PaginatedVenuesListDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async list(
    @TenantDecorator() tenant: Tenant,
    @Query() query: ListVenuesQueryDto,
  ): Promise<PaginatedVenuesListDto> {
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
  @UseInterceptors(FileInterceptor('picture', venuePictureMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a venue',
    description:
      'Tenant staff only. Send as multipart/form-data. Required: name, address, mapsUrl, sportTypes (JSON array string). Provide either `picture` (file) or `pictureUrl` (link) — file takes priority if both sent.',
  })
  @ApiBody({ type: CreateVenueDto })
  @ApiCreatedResponse({ type: VenueResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async create(
    @TenantDecorator() tenant: Tenant,
    @Body() dto: CreateVenueDto,
    @UploadedFile() picture: Express.Multer.File | undefined,
  ): Promise<VenueResponseDto> {
    return this.venuesService.create(tenant.id, dto, picture);
  }
}
