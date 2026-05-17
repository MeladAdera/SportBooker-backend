import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { Pool as PgPool } from 'pg';
import { DB_POOL } from './database.constants';
import { createPoolConfig } from './pool-config';

const logger = new Logger('DatabasePool');

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDbPoolFactory() {
  return {
    provide: DB_POOL,
    inject: [ConfigService],
    useFactory: async (config: ConfigService): Promise<Pool> => {
      const poolConfig = createPoolConfig({
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
        statementTimeoutMillis: config.getOrThrow<number>(
          'DB_STATEMENT_TIMEOUT_MILLIS',
        ),
        ssl: config.get<boolean>('DB_SSL', false),
      });

      const pool = new PgPool(poolConfig);

      pool.on('error', (err) => {
        logger.error('Unexpected database pool error', err.stack);
      });

      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const client = await pool.connect();
          try {
            await client.query('SELECT 1');
          } finally {
            client.release();
          }
          logger.log('Database pool connected');
          return pool;
        } catch (err) {
          lastError = err as Error;
          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
            logger.warn(
              `Connection attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms: ${lastError.message}`,
            );
            await sleep(delay);
          }
        }
      }

      await pool.end();

      const error =
        lastError ?? new Error('Failed to connect to database (no attempts)');
      logger.error(
        `Failed to connect after ${MAX_RETRIES} attempts`,
        error.stack,
      );
      throw error;
    },
  };
}
