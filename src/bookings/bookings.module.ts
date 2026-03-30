import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService, RolesGuard],
  exports: [BookingsRepository],
})
export class BookingsModule {}
