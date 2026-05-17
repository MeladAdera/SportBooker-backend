import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { VenuePictureStorage } from '../venues/venue-picture.storage';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FakePlayersController } from './fake-players.controller';
import { FakePlayersService } from './fake-players.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { WalletRepository } from './wallet.repository';

@Module({
  imports: [forwardRef(() => AuthModule), BookingsModule],
  controllers: [UsersController, FakePlayersController],
  providers: [
    UsersRepository,
    WalletRepository,
    VenuePictureStorage,
    UsersService,
    FakePlayersService,
    RolesGuard,
  ],
  exports: [UsersService, UsersRepository, FakePlayersService],
})
export class UsersModule {}
