import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { ZiinaClient } from './ziina.client';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, ZiinaClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
