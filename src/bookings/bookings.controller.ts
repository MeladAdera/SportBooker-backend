import {
  BadRequestException,
  Controller,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Tenant } from '../common/tenant.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role';
import { BookingsService } from './bookings.service';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':matchId/bookings')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.Player)
  @ApiOperation({
    summary: 'Book a spot on a match',
    description:
      'Player only. Confirms and debits wallet when spots remain; otherwise joins waitlist (pending). Atomic.',
  })
  @ApiCreatedResponse({ type: CreateBookingResponseDto })
  @ApiNotFoundResponse({
    description: 'Match or user not found for this tenant',
  })
  @ApiBadRequestResponse({
    description:
      'Cancelled or past match, inactive venue, or insufficient wallet balance',
  })
  @ApiConflictResponse({ description: 'Already booked this match' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Not a player' })
  async createBooking(
    @TenantDecorator() tenant: Tenant | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<CreateBookingResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    if (!user?.sub) {
      throw new BadRequestException('Authentication required');
    }

    return this.bookingsService.createBookingForPlayer({
      tenantId: tenant.id,
      matchId,
      userId: user.sub,
    });
  }
}
