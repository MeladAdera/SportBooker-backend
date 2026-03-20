import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DB_POOL } from './database.constants';
import { createDbPoolFactory } from './db.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [createDbPoolFactory()],
  exports: [DB_POOL],
})
export class DatabaseModule {}
