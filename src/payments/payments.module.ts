import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { ZiinaClient } from './ziina.client';
import { CryptoService } from '../common/crypto/crypto.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, ZiinaClient, CryptoService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
