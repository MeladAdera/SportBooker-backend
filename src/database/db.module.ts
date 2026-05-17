import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { Pool } from 'pg';
import { DB_POOL } from './database.constants';
import { createDbPoolFactory } from './db.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [createDbPoolFactory()],
  exports: [DB_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
