import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { MatchResponseDto } from './dto/match-response.dto';
import { MatchesService } from './matches.service';

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(RolesGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

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
