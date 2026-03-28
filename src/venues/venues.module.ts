import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VenuePictureStorage } from './venue-picture.storage';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

@Module({
  controllers: [VenuesController],
  providers: [VenuesRepository, VenuePictureStorage, VenuesService, RolesGuard],
  exports: [VenuesService, VenuesRepository],
})
export class VenuesModule {}
