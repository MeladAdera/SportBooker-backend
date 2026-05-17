import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingDetailController } from './booking-detail.controller';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';
import { WaitlistExpiryService } from './waitlist-expiry.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [BookingsController, BookingDetailController],
  providers: [
    BookingsRepository,
    BookingsService,
    WaitlistExpiryService,
    RolesGuard,
  ],
  exports: [BookingsRepository, BookingsService],
})
export class BookingsModule {}
