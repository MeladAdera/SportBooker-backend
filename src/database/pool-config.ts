import type { PoolConfig } from 'pg';

export interface PoolConfigInput {
  /** Full connection string (e.g. Neon). Takes precedence over host/port/etc. */
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
  ssl?: boolean;
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
  const timeout =
    input.statementTimeoutMillis ?? DEFAULT_STATEMENT_TIMEOUT_MILLIS;

  const connectionString = input.connectionString?.trim();
  const target: PoolConfig = connectionString
    ? { connectionString }
    : {
        host: input.host,
        port: input.port,
        database: input.database,
        user: input.user,
        password: input.password,
      };

  return {
    ...target,
    max: input.max ?? DEFAULT_POOL_MAX,
    idleTimeoutMillis: input.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis:
      input.connectionTimeoutMillis ?? DEFAULT_CONNECTION_TIMEOUT_MILLIS,
    options: `-c statement_timeout=${timeout}`,
    ...(input.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}
