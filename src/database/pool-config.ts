import type { PoolConfig } from 'pg';

export interface PoolConfigInput {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

const DEFAULT_POOL_MAX = 20;
const DEFAULT_IDLE_TIMEOUT_MILLIS = 10_000;
const DEFAULT_CONNECTION_TIMEOUT_MILLIS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MILLIS = 30_000;

/**
 * Creates a pg PoolConfig from parsed options.
 * Single source of truth for pool configuration including statement_timeout.
 */
export function createPoolConfig(input: PoolConfigInput): PoolConfig {
  const config: PoolConfig = {
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    password: input.password,
    max: input.max ?? DEFAULT_POOL_MAX,
    idleTimeoutMillis: input.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis:
      input.connectionTimeoutMillis ?? DEFAULT_CONNECTION_TIMEOUT_MILLIS,
  };

  if (input.statementTimeoutMillis !== undefined) {
    config.options = `-c statement_timeout=${input.statementTimeoutMillis}`;
  } else {
    config.options = `-c statement_timeout=${DEFAULT_STATEMENT_TIMEOUT_MILLIS}`;
  }

  return config;
}

function parseOptionalInt(
  value: string | undefined,
  name: string,
  defaultValue: number,
  min = 0,
): number {
  if (value === undefined || value === '') return defaultValue;
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
 * Used by the migration runner.
 */
export function getPoolConfigFromEnv(
  env: Record<string, string | undefined>,
): PoolConfig {
  const host = env.DB_HOST;
  const portStr = env.DB_PORT;
  const database = env.DB_NAME;
  const user = env.DB_USER;
  const password = env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      'Missing required env: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
    );
  }

  const port = parseOptionalInt(portStr, 'DB_PORT', 5432, 1);
  if (port > 65535) {
    throw new Error('Invalid DB_PORT: must be 1-65535');
  }

  return createPoolConfig({
    host,
    port,
    database,
    user,
    password,
    max: parseOptionalInt(env.DB_POOL_MAX, 'DB_POOL_MAX', DEFAULT_POOL_MAX),
    idleTimeoutMillis: parseOptionalInt(
      env.DB_POOL_IDLE_TIMEOUT_MILLIS,
      'DB_POOL_IDLE_TIMEOUT_MILLIS',
      DEFAULT_IDLE_TIMEOUT_MILLIS,
    ),
    connectionTimeoutMillis: parseOptionalInt(
      env.DB_POOL_CONNECTION_TIMEOUT_MILLIS,
      'DB_POOL_CONNECTION_TIMEOUT_MILLIS',
      DEFAULT_CONNECTION_TIMEOUT_MILLIS,
    ),
    statementTimeoutMillis: parseOptionalInt(
      env.DB_STATEMENT_TIMEOUT_MILLIS,
      'DB_STATEMENT_TIMEOUT_MILLIS',
      DEFAULT_STATEMENT_TIMEOUT_MILLIS,
    ),
  });
}
