import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UsersRepository } from '../users/users.repository';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantSettingsController],
  providers: [
    TenantsRepository,
    TenantsService,
    UsersRepository,
    RolesGuard,
    TenantRequiredGuard,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
