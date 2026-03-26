import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminTenantsController } from './admin-tenants.controller';

@Module({
  imports: [TenantsModule],
  controllers: [AdminTenantsController],
  providers: [RolesGuard],
})
export class AdminModule {}
