import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import { ListTenantsQueryDto } from '../tenants/dto/list-tenants-query.dto';
import { PaginatedTenantsListDto } from '../tenants/dto/paginated-tenants-list.dto';
import { TenantActivatedResponseDto } from '../tenants/dto/tenant-activated-response.dto';
import { TenantDeactivatedResponseDto } from '../tenants/dto/tenant-deactivated-response.dto';
import { TenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { UpdateTenantDto } from '../tenants/dto/update-tenant.dto';
import { TenantsService } from '../tenants/tenants.service';

@ApiTags('Admin — Tenants')
@ApiBearerAuth()
@Controller('admin/tenants')
@UseGuards(RolesGuard)
@Roles(UserRole.PlatformAdmin)
export class AdminTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({
    summary: 'List tenants',
    description:
      'Platform super admin only. Paginated directory ordered by created_at descending.',
  })
  @ApiOkResponse({ type: PaginatedTenantsListDto })
  async list(
    @Query() query: ListTenantsQueryDto,
  ): Promise<PaginatedTenantsListDto> {
    return this.tenantsService.listTenantsForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get tenant by id',
    description:
      'Platform super admin only. Returns full tenant configuration including logo and cutoff settings.',
  })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.getTenantByIdForAdmin(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate tenant',
    description:
      'Platform super admin only. Soft-deactivates tenant (is_active = false); subdomain requests receive 403. Idempotent. If this was the last active tenant, all tenant Host traffic stays 403 until a tenant is re-activated.',
  })
  @ApiOkResponse({ type: TenantDeactivatedResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantDeactivatedResponseDto> {
    return this.tenantsService.deactivateTenantForAdmin(id);
  }

  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate tenant',
    description:
      'Platform super admin only. Sets is_active = true; subdomain traffic works again after tenant middleware cache refresh. Idempotent.',
  })
  @ApiOkResponse({ type: TenantActivatedResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantActivatedResponseDto> {
    return this.tenantsService.activateTenantForAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update tenant settings',
    description:
      'Platform super admin only. Partial update; omitted fields unchanged. Slug is immutable and not in this schema; unknown properties return 422.',
  })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.updateTenantForAdmin(id, dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Create tenant',
    description:
      'Platform super admin only. Creates a new active tenant with default timezone Asia/Dubai and cancel cutoff 24h unless overridden.',
  })
  @ApiCreatedResponse({
    description: 'Tenant created',
    type: TenantResponseDto,
  })
  @ApiConflictResponse({ description: 'Slug already exists' })
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenantsService.createTenant(dto);
  }
}
