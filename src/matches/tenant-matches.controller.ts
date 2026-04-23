import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AutoFillFakeMatchDto } from './dto/auto-fill-fake-match.dto';
import { AutoFillFakeMatchResponseDto } from './dto/auto-fill-fake-match-response.dto';
import { ClearFakesResponseDto } from './dto/clear-fakes-response.dto';
import { ListTenantMatchesQueryDto } from './dto/list-tenant-matches-query.dto';
import { PaginatedOperatorMatchesDto } from './dto/paginated-operator-matches.dto';
import { SubmitMatchResultsDto } from './dto/submit-match-results.dto';
import { MatchResultsResponseDto } from './dto/match-results-response.dto';
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
    return this.matchesService.listForOperator(
      tenant.id,
      query,
      tenant.timezone,
    );
  }

  @Post(':id/results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit match results',
    description:
      'Tenant staff and above. Submit final result and per-player stats (goals, assists, MVP) for a completed match. Can only be submitted once.',
  })
  @ApiWrappedCreatedResponse({ type: MatchResultsResponseDto })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiBadRequestResponse({
    description:
      'Match not completed, more than one MVP, or invalid player IDs',
  })
  @ApiConflictResponse({
    description: 'Results already submitted for this match',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async submitResults(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitMatchResultsDto,
  ): Promise<MatchResultsResponseDto> {
    return this.matchesService.submitMatchResults(tenant.id, id, dto, user.sub);
  }

  @Post(':id/auto-fill-fake')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Auto-fill a fake match with random fake players',
    description:
      'Tenant admin only. Picks random fake players (users.is_fake = true) ' +
      'who are not already booked on this match and creates confirmed bookings ' +
      'for them at price 0. Caps the insert at (maxCapacity - minRealSpots) so ' +
      'real players always have at least minRealSpots free seats. ' +
      'When `count` is omitted, fills as many seats as the fake quota allows.',
  })
  @ApiWrappedOkResponse({
    description: 'Auto-fill summary',
    type: AutoFillFakeMatchResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiBadRequestResponse({
    description:
      'Match is not fake, has been cancelled, or is not in the future',
  })
  @ApiConflictResponse({
    description:
      'No fake quota left for this match (capacity reached or already at the fake cap)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async autoFillFake(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AutoFillFakeMatchDto,
  ): Promise<AutoFillFakeMatchResponseDto> {
    return this.matchesService.autoFillFakeMatch({
      tenantId: tenant.id,
      matchId: id,
      count: dto.count ?? null,
    });
  }

  @Post(':id/clear-fakes')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
  @ApiOperation({
    summary: 'Remove all fake players from a fake match',
    description:
      'Tenant admin only. Hard-deletes every confirmed booking held by a fake ' +
      'user (users.is_fake = true) on this match. Intended for once the match ' +
      'has organic real demand and the fake roster is no longer needed. ' +
      'After the delete commits, one FIFO waitlist promotion runs per freed ' +
      'seat (same logic as a player cancellation) so pending real players ' +
      'are upgraded to confirmed asynchronously.',
  })
  @ApiWrappedOkResponse({
    description: 'Clear-fakes summary',
    type: ClearFakesResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Match not found for this tenant' })
  @ApiBadRequestResponse({
    description:
      'Match is not fake, has been cancelled, or is not in the future',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async clearFakes(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClearFakesResponseDto> {
    return this.matchesService.clearFakesForMatch({
      tenantId: tenant.id,
      matchId: id,
    });
  }

  @Get(':id/results')
  @ApiOperation({
    summary: 'Get match results',
    description:
      'Tenant staff and above. Fetch submitted result and per-player stats for a completed match.',
  })
  @ApiWrappedOkResponse({ type: MatchResultsResponseDto })
  @ApiNotFoundResponse({
    description: 'Match not found or results not yet submitted',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  async getResults(
    @TenantDecorator() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MatchResultsResponseDto> {
    return this.matchesService.getMatchResults(tenant.id, id);
  }
}
