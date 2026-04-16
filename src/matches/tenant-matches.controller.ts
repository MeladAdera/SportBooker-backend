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
