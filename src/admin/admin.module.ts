import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { VenuePictureStorage } from '../venues/venue-picture.storage';
import { AdminTenantsController } from './admin-tenants.controller';

@Module({
  imports: [TenantsModule],
  controllers: [AdminTenantsController],
  providers: [RolesGuard, VenuePictureStorage],
})
export class AdminModule {}
