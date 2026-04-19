import {
  Body,
  Controller,
  Delete,
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
import type { Tenant } from '../common/tenant.types';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { RemoveFromWaitlistResponseDto } from '../bookings/dto/remove-from-waitlist-response.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import { MatchDetailResponseDto } from './dto/match-detail-response.dto';
import { MatchResponseDto } from './dto/match-response.dto';
import { CancelMatchResponseDto } from './dto/cancel-match-response.dto';
import { OperatorWaitlistEntryDto } from './dto/operator-waitlist-entry.dto';
import { PaginatedMatchesListDto } from './dto/paginated-matches-list.dto';
import { MatchesService } from './matches.service';

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(TenantRequiredGuard, RolesGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: 'List upcoming matches',
    description:
      'Any authenticated user in the tenant. Returns upcoming matches only. ' +
      'Filters (sportType, venueId, date in tenant-local day, available, dayOfWeek) apply first; ' +
      'sortBy is applied on the full filtered set; page/limit slice that list. ' +
      'total counts rows after filters only. dayOfWeek uses ISO 1=Mon…7=Sun in tenant timezone; repeat param or comma-separated list (OR).',
  })
  @ApiWrappedOkResponse({ type: PaginatedMatchesListDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async list(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMatchesQueryDto,
  ): Promise<PaginatedMatchesListDto> {
    return this.matchesService.listUpcomingForTenant(
      tenant.id,
      query,
      tenant.timezone,
      user.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get match details',
    description:
      'Any authenticated user in the tenant. Includes confirmed player roster and FIFO-ordered waitlist with queue positions.',
  })
  @ApiWrappedOkResponse({ type: MatchDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getById(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MatchDetailResponseDto> {
    return this.matchesService.getDetailForTenant(tenant.id, id, user.role);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Cancel a match and refund confirmed players',
    description:
      'Tenant admin only. Refunds paid_amount to wallets, records refund transactions, cancels all bookings. Emails sent after commit.',
  })
  @ApiWrappedOkResponse({ type: CancelMatchResponseDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiBadRequestResponse({
    description: 'Match is already cancelled or has already ended',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async cancelMatch(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CancelMatchResponseDto> {
    return this.matchesService.cancelMatchForTenant(tenant.id, id);
  }

  @Get(':matchId/waitlist')
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Get match waitlist (operator)',
    description:
      'Tenant staff and above. Returns all pending (waitlisted) bookings for a match, FIFO-ordered with queue position, email, and paid amount.',
  })
  @ApiWrappedOkResponse({ type: OperatorWaitlistEntryDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async getWaitlist(
    @TenantDecorator() tenant: Tenant,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<OperatorWaitlistEntryDto[]> {
    return this.matchesService.getWaitlistForMatch(tenant.id, matchId);
  }

  @Delete(':matchId/waitlist/:bookingId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Remove a player from the waitlist (operator)',
    description:
      'Tenant admin only. Cancels the pending booking and refunds the prepaid amount to the player wallet. Does not trigger waitlist promotion.',
  })
  @ApiWrappedOkResponse({ type: RemoveFromWaitlistResponseDto })
  @ApiNotFoundResponse({ description: 'Waitlist entry not found' })
  @ApiBadRequestResponse({
    description: 'Booking is not pending (not on waitlist)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async removeFromWaitlist(
    @TenantDecorator() tenant: Tenant,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<RemoveFromWaitlistResponseDto> {
    return this.matchesService.removeFromWaitlist({
      tenantId: tenant.id,
      matchId,
      bookingId,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Update a match (partial)',
    description:
      'Tenant staff only. Cannot update cancelled or completed matches. Capacity cannot drop below confirmed bookings.',
  })
  @ApiWrappedOkResponse({ type: MatchResponseDto })
  @ApiNotFoundResponse({
    description: 'Match or venue not found for this tenant',
  })
  @ApiBadRequestResponse({
    description:
      'No fields provided, cancelled or ended match, inactive venue, or validation error',
  })
  @ApiConflictResponse({
    description:
      'Capacity below confirmed count, overlapping slot, or duplicate venue+time',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async update(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    return this.matchesService.updateForTenant(tenant.id, id, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin, UserRole.TenantStaff)
  @ApiOperation({
    summary: 'Create a match',
    description:
      'Tenant staff only. Venue must belong to this tenant and be active. scheduledAt is stored in UTC.',
  })
  @ApiWrappedCreatedResponse({ type: MatchResponseDto })
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
    @TenantDecorator() tenant: Tenant,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchResponseDto> {
    return this.matchesService.createForTenant(tenant.id, dto);
  }
}
