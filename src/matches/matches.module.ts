import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VenuesModule } from '../venues/venues.module';
import { MatchesController } from './matches.controller';
import { TenantMatchesController } from './tenant-matches.controller';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';

@Module({
  imports: [VenuesModule, BookingsModule, AuthModule],
  controllers: [MatchesController, TenantMatchesController],
  providers: [MatchesRepository, MatchesService, RolesGuard],
  exports: [MatchesService],
})
export class MatchesModule {}
