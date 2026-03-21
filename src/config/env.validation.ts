export interface ValidatedEnv {
  PORT: number;
  APP_DOMAIN: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_POOL_MAX: number;
  DB_POOL_IDLE_TIMEOUT_MILLIS: number;
  DB_POOL_CONNECTION_TIMEOUT_MILLIS: number;
}

function parsePort(value: unknown, name: string, min = 1, max = 65535): number {
  const num = value !== undefined ? Number(value) : NaN;
  if (Number.isNaN(num) || num < min || num > max) {
    throw new Error(
      `Invalid or missing ${name} in .env. Must be a number between ${min} and ${max}.`,
    );
  }
  return num;
}

function parseRequiredString(value: unknown, name: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    throw new Error(`Invalid or missing ${name} in .env.`);
  }
  return s;
}

function parseOptionalInt(
  value: unknown,
  name: string,
  defaultValue: number,
): number {
  if (value === undefined || value === '') return defaultValue;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    throw new Error(`Invalid ${name} in .env. Must be a non-negative number.`);
  }
  return num;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  return {
    PORT: parsePort(config['PORT'], 'PORT'),
    APP_DOMAIN: parseRequiredString(config['APP_DOMAIN'], 'APP_DOMAIN'),
    DB_HOST: parseRequiredString(config['DB_HOST'], 'DB_HOST'),
    DB_PORT: parsePort(config['DB_PORT'], 'DB_PORT'),
    DB_NAME: parseRequiredString(config['DB_NAME'], 'DB_NAME'),
    DB_USER: parseRequiredString(config['DB_USER'], 'DB_USER'),
    DB_PASSWORD: parseRequiredString(config['DB_PASSWORD'], 'DB_PASSWORD'),
    DB_POOL_MAX: parseOptionalInt(config['DB_POOL_MAX'], 'DB_POOL_MAX', 10),
    DB_POOL_IDLE_TIMEOUT_MILLIS: parseOptionalInt(
      config['DB_POOL_IDLE_TIMEOUT_MILLIS'],
      'DB_POOL_IDLE_TIMEOUT_MILLIS',
      10000,
    ),
    DB_POOL_CONNECTION_TIMEOUT_MILLIS: parseOptionalInt(
      config['DB_POOL_CONNECTION_TIMEOUT_MILLIS'],
      'DB_POOL_CONNECTION_TIMEOUT_MILLIS',
      5000,
    ),
  };
}
