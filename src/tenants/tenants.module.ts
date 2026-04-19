import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UsersRepository } from '../users/users.repository';
import { TenantPublicController } from './tenant-public.controller';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';
import { PaymentsModule } from '../payments/payments.module';
import { CryptoService } from '../common/crypto/crypto.service';
import { VenuePictureStorage } from '../venues/venue-picture.storage';

@Module({
  imports: [PaymentsModule],
  controllers: [TenantPublicController, TenantSettingsController],
  providers: [
    TenantsRepository,
    TenantsService,
    UsersRepository,
    RolesGuard,
    TenantRequiredGuard,
    CryptoService,
    VenuePictureStorage,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
