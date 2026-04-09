import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../common/decorators/api-wrapped-response.decorator';
import type { Tenant } from '../common/tenant.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { BookingsService } from './bookings.service';
import { BookingDetailResponseDto } from './dto/booking-detail-response.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(TenantRequiredGuard, RolesGuard)
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
  @ApiWrappedOkResponse({ type: BookingDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Not found or not allowed' })
  async getBookingDetail(
    @TenantDecorator() tenant: Tenant,
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingDetailResponseDto> {
    return this.bookingsService.getBookingDetail({
      tenantId: tenant.id,
      bookingId,
      actorUserId: user.sub,
      actorRole: user.role,
    });
  }
}
