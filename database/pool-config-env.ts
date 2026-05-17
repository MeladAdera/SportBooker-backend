import type { PoolConfig } from 'pg';
import { createPoolConfig } from '../src/database/pool-config';

function parseOptionalInt(
  value: string | undefined,
  name: string,
  min = 0,
): number | undefined {
  if (value === undefined || value === '') return undefined;
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num < min) {
    throw new Error(
      `Invalid ${name} in .env. Must be a number >= ${min}. Got: ${value}`,
    );
  }
  return num;
}

/**
 * Builds pool config from raw env (e.g. process.env).
 * Used by the migration runner and seed scripts.
 */
export function getPoolConfigFromEnv(
  env: Record<string, string | undefined>,
): PoolConfig {
  const host = env.DB_HOST;
  const portStr = env.DB_PORT;
  const database = env.DB_NAME;
  const user = env.DB_USER;
  const password = env.DB_PASSWORD;
  console.log(host, portStr, database, user, password);

  if (!host || !database || !user || !password) {
    throw new Error(
      'Missing required env: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
    );
  }

  const port = parseOptionalInt(portStr, 'DB_PORT', 1) ?? 5432;
  if (port > 65535) {
    throw new Error('Invalid DB_PORT: must be 1-65535');
  }

  return createPoolConfig({
    host,
    port,
    database,
    user,
    password,
    ssl: env.DB_SSL === 'true' || env.DB_SSL === '1',
    max: parseOptionalInt(env.DB_POOL_MAX, 'DB_POOL_MAX', 1),
    idleTimeoutMillis: parseOptionalInt(
      env.DB_POOL_IDLE_TIMEOUT_MILLIS,
      'DB_POOL_IDLE_TIMEOUT_MILLIS',
    ),
    connectionTimeoutMillis: parseOptionalInt(
      env.DB_POOL_CONNECTION_TIMEOUT_MILLIS,
      'DB_POOL_CONNECTION_TIMEOUT_MILLIS',
    ),
    statementTimeoutMillis: parseOptionalInt(
      env.DB_STATEMENT_TIMEOUT_MILLIS,
      'DB_STATEMENT_TIMEOUT_MILLIS',
    ),
  });
}
