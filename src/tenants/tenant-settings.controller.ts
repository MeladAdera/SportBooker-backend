import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../common/decorators/api-wrapped-response.decorator';
import type { Tenant } from '../common/tenant.types';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenant Settings')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(TenantRequiredGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
export class TenantSettingsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get own tenant settings',
    description:
      'Super admin only. Returns full configuration for the tenant resolved from the request Host header.',
  })
  @ApiWrappedOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Super admin only' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async getSettings(
    @TenantDecorator() tenant: Tenant,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.getTenantByIdForAdmin(tenant.id);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update own tenant settings',
    description:
      'Super admin only. Partial update of the tenant resolved from the request Host header. Updatable fields: name, logoUrl, timezone, cancelCutoffHours. is_active is managed exclusively by platform_admin.',
  })
  @ApiWrappedOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Super admin only' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async updateSettings(
    @TenantDecorator() tenant: Tenant,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.updateTenantForAdmin(tenant.id, dto);
  }
}
