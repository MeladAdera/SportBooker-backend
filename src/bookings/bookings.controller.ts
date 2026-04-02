import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Tenant } from '../common/tenant.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { BookingsService } from './bookings.service';
import { CancelPlayerBookingResponseDto } from './dto/cancel-player-booking-response.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(TenantRequiredGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':matchId/bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Roles(UserRole.Player)
  @ApiOperation({
    summary: 'Cancel my confirmed booking (player)',
    description:
      "At least tenant's cancel_cutoff_hours before match start. No refund. Waitlist may be promoted after commit; emails sent asynchronously.",
  })
  @ApiBadRequestResponse({
    description:
      "Not confirmed, already cancelled, match past/cancelled, or inside tenant's cutoff window",
  })
  @ApiForbiddenResponse({ description: 'Not the booking owner' })
  @ApiNotFoundResponse({
    description: 'Booking not found for this match/tenant',
  })
  @ApiOkResponse({ type: CancelPlayerBookingResponseDto })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async cancelMyBooking(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<CancelPlayerBookingResponseDto> {
    return this.bookingsService.cancelBookingForPlayer({
      tenantId: tenant.id,
      matchId,
      bookingId,
      userId: user.sub,
      cancelCutoffHours: tenant.cancel_cutoff_hours,
    });
  }

  @Post(':matchId/bookings')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @ApiConflictResponse({
    description:
      'Active booking already exists for this match (pending or confirmed). Cancelled bookings do not block rebooking.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Not a player' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async createBooking(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<CreateBookingResponseDto> {
    return this.bookingsService.createBookingForPlayer({
      tenantId: tenant.id,
      matchId,
      userId: user.sub,
    });
  }
}
