import { ConfigService } from '@nestjs/config';
import type { Pool, PoolConfig } from 'pg';
import { Pool as PgPool } from 'pg';
import { DB_POOL } from './database.constants';

export function createDbPoolFactory(): {
  provide: typeof DB_POOL;
  useFactory: (config: ConfigService) => Promise<Pool>;
  inject: [typeof ConfigService];
} {
  return {
    provide: DB_POOL,
    inject: [ConfigService],
    useFactory: async (config: ConfigService): Promise<Pool> => {
      const poolConfig: PoolConfig = {
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        database: config.getOrThrow<string>('DB_NAME'),
        user: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        max: config.getOrThrow<number>('DB_POOL_MAX'),
        idleTimeoutMillis: config.getOrThrow<number>(
          'DB_POOL_IDLE_TIMEOUT_MILLIS',
        ),
        connectionTimeoutMillis: config.getOrThrow<number>(
          'DB_POOL_CONNECTION_TIMEOUT_MILLIS',
        ),
      };

      const pool = new PgPool(poolConfig);

      pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
      });

      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      return pool;
    },
  };
}
