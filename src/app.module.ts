import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantUserMatchGuard } from './auth/guards/tenant-user-match.guard';
import { AuthModule } from './auth/auth.module';
import { envSchema } from './config/env.schema';
import { DatabaseModule } from './database/db.module';
import { AdminModule } from './admin/admin.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';
import { VenuesModule } from './venues/venues.module';
import { MatchesModule } from './matches/matches.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';

/** Extract client IP from request; supports X-Forwarded-For when behind a proxy. */
function getClientIp(req: Record<string, unknown>): string {
  const headers = req.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const forwarded = headers?.['x-forwarded-for'];
  const forwardedStr =
    typeof forwarded === 'string'
      ? forwarded
      : Array.isArray(forwarded)
        ? forwarded[0]
        : undefined;
  if (forwardedStr) {
    const client = forwardedStr.split(',')[0]?.trim();
    if (client) return client;
  }
  const ip =
    req.ip ??
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress;
  return typeof ip === 'string' ? ip : 'unknown';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        limit: 1000,
        ttl: 60_000,
        getTracker: (req) =>
          Promise.resolve(getClientIp(req as Record<string, unknown>)),
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TenantModule,
    AuthModule,
    UsersModule,
    VenuesModule,
    MatchesModule,
    BookingsModule,
    AdminModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantUserMatchGuard },
  ],
})
export class AppModule {}
