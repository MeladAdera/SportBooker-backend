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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { UserRole } from '../users/user-role';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import { MatchDetailResponseDto } from './dto/match-detail-response.dto';
import { MatchResponseDto } from './dto/match-response.dto';
import { CancelMatchResponseDto } from './dto/cancel-match-response.dto';
import { PaginatedMatchesListDto } from './dto/paginated-matches-list.dto';
import { MatchesService } from './matches.service';

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(RolesGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: 'List upcoming matches',
    description:
      'Any authenticated user in the tenant. Returns status upcoming only, ordered by scheduled time. Filters: sportType, venueId, date (UTC calendar day), available (spots left).',
  })
  @ApiOkResponse({ type: PaginatedMatchesListDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async list(
    @TenantDecorator() tenant: Tenant | undefined,
    @Query() query: ListMatchesQueryDto,
  ): Promise<PaginatedMatchesListDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.matchesService.listUpcomingForTenant(tenant.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get match details',
    description:
      'Any authenticated user in the tenant. Includes confirmed player roster only (pending / waitlist excluded).',
  })
  @ApiOkResponse({ type: MatchDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getById(
    @TenantDecorator() tenant: Tenant | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MatchDetailResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.matchesService.getDetailForTenant(tenant.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Cancel a match and refund confirmed players',
    description:
      'Tenant admin only. Refunds paid_amount to wallets, records refund transactions, cancels all bookings. Emails sent after commit.',
  })
  @ApiOkResponse({ type: CancelMatchResponseDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiBadRequestResponse({ description: 'Match is already cancelled' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async cancelMatch(
    @TenantDecorator() tenant: Tenant | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CancelMatchResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.matchesService.cancelMatchForTenant(tenant.id, id);
  }

  @Patch(':id')
  @Roles(UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Update a match (partial)',
    description:
      'Tenant staff only. Cannot update cancelled matches. Capacity cannot drop below confirmed bookings.',
  })
  @ApiOkResponse({ type: MatchResponseDto })
  @ApiNotFoundResponse({
    description: 'Match or venue not found for this tenant',
  })
  @ApiBadRequestResponse({
    description:
      'No fields provided, cancelled match, inactive venue, or validation error',
  })
  @ApiConflictResponse({
    description:
      'Capacity below confirmed count, overlapping slot, or duplicate venue+time',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async update(
    @TenantDecorator() tenant: Tenant | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.matchesService.updateForTenant(tenant.id, id, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Create a match',
    description:
      'Tenant staff only. Venue must belong to this tenant and be active. scheduledAt is stored in UTC.',
  })
  @ApiCreatedResponse({ type: MatchResponseDto })
  @ApiNotFoundResponse({ description: 'Venue not found for this tenant' })
  @ApiConflictResponse({
    description:
      'Same start time as existing match (unique), or overlapping time slot at this venue',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed, past scheduledAt, or inactive venue',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async create(
    @TenantDecorator() tenant: Tenant | undefined,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.matchesService.createForTenant(tenant.id, dto);
  }
}
