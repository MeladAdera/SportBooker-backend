import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VenuesModule } from '../venues/venues.module';
import { MatchesController } from './matches.controller';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';

@Module({
  imports: [VenuesModule],
  controllers: [MatchesController],
  providers: [MatchesRepository, MatchesService, RolesGuard],
  exports: [MatchesService],
})
export class MatchesModule {}
