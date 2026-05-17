import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../common/decorators/api-wrapped-response.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import type { Tenant } from '../common/tenant.types';
import { TenantPublicInfoDto } from './dto/tenant-public-info.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenant')
@Controller('tenant')
@Public()
@UseGuards(TenantRequiredGuard)
export class TenantPublicController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('info')
  @ApiOperation({
    summary: 'Get public tenant info',
    description:
      'No auth required. Returns the tenant name, slug, and logo URL resolved from the request Host header. ' +
      'Use this on the login/register page to display the correct branding.',
  })
  @ApiWrappedOkResponse({ type: TenantPublicInfoDto })
  @ApiBadRequestResponse({ description: 'Missing or invalid subdomain' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async getPublicInfo(
    @TenantDecorator() tenant: Tenant,
  ): Promise<TenantPublicInfoDto> {
    return this.tenantsService.getPublicTenantInfo(tenant.id);
  }
}
