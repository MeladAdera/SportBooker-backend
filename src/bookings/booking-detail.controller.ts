import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Tenant } from '../common/tenant.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role';
import { BookingsService } from './bookings.service';
import { BookingDetailResponseDto } from './dto/booking-detail-response.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(RolesGuard)
export class BookingDetailController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(':bookingId')
  @Roles(
    UserRole.SuperAdmin,
    UserRole.TenantAdmin,
    UserRole.TenantStaff,
    UserRole.Player,
  )
  @ApiOperation({
    summary: 'Get booking by id',
    description:
      'Player: own booking only. Tenant admin/staff: any booking in the tenant. Includes match and venue snapshots.',
  })
  @ApiOkResponse({ type: BookingDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Not found or not allowed' })
  async getBookingDetail(
    @TenantDecorator() tenant: Tenant | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingDetailResponseDto> {
    if (!tenant) {
      throw new BadRequestException(
        'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
      );
    }
    return this.bookingsService.getBookingDetail({
      tenantId: tenant.id,
      bookingId,
      actorUserId: user.sub,
      actorRole: user.role,
    });
  }
}
