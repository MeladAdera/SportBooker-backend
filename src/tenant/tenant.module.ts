import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';

@Module({})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: '/', method: RequestMethod.GET },
        { path: 'admin/tenants', method: RequestMethod.ALL },
        { path: 'admin/tenants/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
