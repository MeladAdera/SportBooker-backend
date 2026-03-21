import 'dotenv/config';

/**
 * Deterministic migration runner.
 * Reads .sql files from database/migrations/ in filename-sorted order,
 * creates _migrations table if not exists, skips already-applied files.
 *
 * Usage: npm run migrate
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

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

function getPoolConfig(): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
} {
  const host = process.env.DB_HOST;
  const portStr = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      'Missing required env: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
    );
  }

  const port = parseOptionalInt(portStr, 'DB_PORT', 5432, 1);
  if (port > 65535) {
    throw new Error('Invalid DB_PORT: must be 1-65535');
  }

  return {
    host,
    port,
    database,
    user,
    password,
    max: parseOptionalInt(process.env.DB_POOL_MAX, 'DB_POOL_MAX', 10),
    idleTimeoutMillis: parseOptionalInt(
      process.env.DB_POOL_IDLE_TIMEOUT_MILLIS,
      'DB_POOL_IDLE_TIMEOUT_MILLIS',
      10000,
    ),
    connectionTimeoutMillis: parseOptionalInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MILLIS,
      'DB_POOL_CONNECTION_TIMEOUT_MILLIS',
      5000,
    ),
  };
}

async function run(): Promise<void> {
  const pool = new Pool(getPoolConfig());

  const client = await pool.connect();
  try {
    await client.query(MIGRATIONS_TABLE);

    const { rows: applied } = await client.query<{ filename: string }>(
      'SELECT filename FROM _migrations',
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      if (appliedSet.has(filename)) {
        console.log(`[skip] ${filename}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [
        filename,
      ]);
      console.log(`[applied] ${filename}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
