import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { ListTenantMatchesQueryDto } from './dto/list-tenant-matches-query.dto';
import { PaginatedOperatorMatchesDto } from './dto/paginated-operator-matches.dto';
import { MatchesService } from './matches.service';

@ApiTags('Tenant — Matches')
@ApiBearerAuth()
@Controller('tenant/matches')
@UseGuards(TenantRequiredGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
export class TenantMatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: 'Operator match management list',
    description:
      'Tenant staff and above. Returns all matches for the tenant across all statuses. Supports filtering by status, date range, venue, sport type, and title search. Ordered by scheduledAt descending.',
  })
  @ApiWrappedOkResponse({ type: PaginatedOperatorMatchesDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async list(
    @TenantDecorator() tenant: Tenant,
    @Query() query: ListTenantMatchesQueryDto,
  ): Promise<PaginatedOperatorMatchesDto> {
    return this.matchesService.listForOperator(tenant.id, query);
  }
}
