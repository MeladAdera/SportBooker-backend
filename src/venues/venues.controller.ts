import {
  BadRequestException,
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
import { memoryStorage } from 'multer';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiWrappedCreatedResponse,
  ApiWrappedOkResponse,
} from '../common/decorators/api-wrapped-response.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Tenant } from '../common/tenant.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { PaginatedVenuesListDto } from './dto/paginated-venues-list.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueActivatedResponseDto } from './dto/venue-activated-response.dto';
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
    if (!ok) {
      cb(
        new BadRequestException('Picture must be JPEG, PNG, WebP, or GIF'),
        false,
      );
      return;
    }
    cb(null, true);
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
    summary: 'List venues',
    description:
      'Any authenticated user in the tenant. Paginated active venues; default page 1, limit 50. Optional sportType filters venues that offer that sport. Tenant admins may pass includeInactive=true to include deactivated venues.',
  })
  @ApiWrappedOkResponse({ type: PaginatedVenuesListDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async list(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListVenuesQueryDto,
  ): Promise<PaginatedVenuesListDto> {
    const role = user.role as UserRole;
    const isAdmin =
      role === UserRole.TenantAdmin ||
      role === UserRole.SuperAdmin ||
      role === UserRole.PlatformAdmin;
    const includeInactive = isAdmin && !!query.includeInactive;
    return this.venuesService.listForBrowse(tenant.id, query, includeInactive);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get venue details',
    description:
      'Any authenticated user. Returns the venue for this tenant; 404 if missing or not in this tenant. Non-admins also get 404 for inactive venues. Tenant admins can retrieve inactive venues.',
  })
  @ApiWrappedOkResponse({ type: VenueDetailDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getById(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VenueDetailDto> {
    const role = user.role as UserRole;
    const isAdmin =
      role === UserRole.TenantAdmin ||
      role === UserRole.SuperAdmin ||
      role === UserRole.PlatformAdmin;
    return this.venuesService.getByIdForTenant(tenant.id, id, isAdmin);
  }

  @Patch(':id')
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
  @UseInterceptors(FileInterceptor('picture', venuePictureMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a venue (partial)',
    description:
      'Tenant staff only. Send as multipart/form-data with only fields to change (name, address, mapsUrl, pictureUrl, sportTypes, picture). Does not change activation — use POST /venues/:id/deactivate or POST /venues/:id/activate. Venue must belong to this tenant.',
  })
  @ApiBody({ type: UpdateVenueDto })
  @ApiWrappedOkResponse({ type: VenueResponseDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async update(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
    @UploadedFile() picture: Express.Multer.File | undefined,
  ): Promise<VenueResponseDto> {
    return this.venuesService.updateForTenant(tenant.id, id, dto, picture);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Deactivate a venue',
    description:
      'Tenant admin only. Sets is_active to false (no hard delete). Blocked with 409 if the venue has scheduled (upcoming) or in-progress matches.',
  })
  @ApiWrappedOkResponse({ type: VenueDeactivatedResponseDto })
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

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Activate a venue',
    description:
      'Tenant admin only. Sets is_active to true (re-enables a previously deactivated venue). Idempotent when already active.',
  })
  @ApiWrappedOkResponse({ type: VenueActivatedResponseDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({
    description: 'Insufficient role (tenant admin only)',
  })
  async activate(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VenueActivatedResponseDto> {
    return this.venuesService.activateForTenant(tenant.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
  @UseInterceptors(FileInterceptor('picture', venuePictureMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a venue',
    description:
      'Tenant staff only. Send as multipart/form-data. Required: name, address, mapsUrl, sportTypes (JSON array string). Provide either `picture` (file) or `pictureUrl` (link) — file takes priority if both sent.',
  })
  @ApiBody({ type: CreateVenueDto })
  @ApiWrappedCreatedResponse({ type: VenueResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid picture file (e.g. wrong MIME type) or validation failure',
  })
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
