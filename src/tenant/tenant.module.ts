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
        { path: 'test-validation', method: RequestMethod.ALL },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        // Payment provider callbacks hit API host (e.g. api.<domain>), not tenant subdomains.
        { path: 'payments/webhook', method: RequestMethod.POST },
        { path: 'admin/tenants', method: RequestMethod.ALL },
        { path: 'admin/tenants/(.*)', method: RequestMethod.ALL },
        { path: 'uploads/(.*)', method: RequestMethod.GET },
        // OpenAPI (Swagger UI + JSON) — no tenant subdomain on apex/staging hosts
        { path: 'api/docs', method: RequestMethod.ALL },
        { path: 'api/docs/(.*)', method: RequestMethod.ALL },
        { path: 'api/docs-json', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
