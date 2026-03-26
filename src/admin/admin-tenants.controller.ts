import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import { ListTenantsQueryDto } from '../tenants/dto/list-tenants-query.dto';
import { PaginatedTenantsListDto } from '../tenants/dto/paginated-tenants-list.dto';
import { TenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { TenantsService } from '../tenants/tenants.service';

@ApiTags('Admin — Tenants')
@ApiBearerAuth()
@Controller('admin/tenants')
@UseGuards(RolesGuard)
@Roles('super_admin')
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
