import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { VenuesModule } from '../venues/venues.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { WalletRepository } from './wallet.repository';

@Module({
  imports: [forwardRef(() => AuthModule), BookingsModule, VenuesModule],
  controllers: [UsersController],
  providers: [UsersRepository, WalletRepository, UsersService, RolesGuard],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
