import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VenuePictureStorage } from './venue-picture.storage';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController],
  providers: [VenuesRepository, VenuePictureStorage, VenuesService, RolesGuard],
  exports: [VenuesService, VenuesRepository, VenuePictureStorage],
})
export class VenuesModule {}
