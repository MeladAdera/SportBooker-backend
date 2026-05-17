import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BulkCreateFakePlayersDto } from './dto/bulk-create-fake-players.dto';
import { BulkCreateFakePlayersResponseDto } from './dto/bulk-create-fake-players-response.dto';
import { CreateFakePlayerDto } from './dto/create-fake-player.dto';
import { FakePlayerResponseDto } from './dto/fake-player-response.dto';
import { FakePlayersService } from './fake-players.service';
import { UserRole } from './user-role';

/**
 * Tenant-admin tooling for seeding demo users. Fake players appear in roster /
 * waitlist views like real users, but are blocked from login, payments, and
 * notifications elsewhere in the system.
 */
@ApiTags('Admin — Fake players')
@ApiBearerAuth()
@Controller('admin/fake-players')
@UseGuards(RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.TenantAdmin)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@ApiForbiddenResponse({ description: 'Insufficient role' })
export class FakePlayersController {
  constructor(private readonly fakePlayersService: FakePlayersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a single fake player',
    description:
      'Tenant admin only. Generates a `users` row with `is_fake = true`, ' +
      'role `player`, no password hash and a synthetic `fake+<uuid>@fake.local` email. ' +
      'Any field omitted from the body is filled in by faker.',
  })
  @ApiWrappedCreatedResponse({
    description: 'Created fake player',
    type: FakePlayerResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async createOne(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFakePlayerDto,
  ): Promise<FakePlayerResponseDto> {
    return this.fakePlayersService.createOne(user.tenantId, dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk-generate fake players',
    description:
      'Tenant admin only. Inserts up to 200 fake players in one round trip. ' +
      'Each row gets a unique faker name, a pravatar photo URL, and a random skill / position / foot / preferred-days profile.',
  })
  @ApiWrappedCreatedResponse({
    description: 'Bulk-created fake players',
    type: BulkCreateFakePlayersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (count out of allowed range)',
  })
  async createBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkCreateFakePlayersDto,
  ): Promise<BulkCreateFakePlayersResponseDto> {
    const players = await this.fakePlayersService.createBulk(
      user.tenantId,
      dto.count,
      dto.seed,
    );
    return { count: players.length, players };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hard-delete a fake player',
    description:
      'Tenant admin only. Cascades any bookings the fake player held. Refuses to delete real users (404).',
  })
  @ApiWrappedOkResponse({
    description: 'Deleted',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Fake player not found in this tenant',
  })
  async deleteOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    await this.fakePlayersService.deleteFakePlayer(user.tenantId, id);
    return { deleted: true };
  }
}
