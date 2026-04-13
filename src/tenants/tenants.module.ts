import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UsersRepository } from '../users/users.repository';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';
import { PaymentsModule } from '../payments/payments.module';
import { CryptoService } from '../common/crypto/crypto.service';

@Module({
  imports: [PaymentsModule],
  controllers: [TenantSettingsController],
  providers: [
    TenantsRepository,
    TenantsService,
    UsersRepository,
    RolesGuard,
    TenantRequiredGuard,
    CryptoService,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
