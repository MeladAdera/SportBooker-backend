import 'dotenv/config';

/**
 * Deterministic migration runner.
 * Reads .sql files from database/migrations/ in filename-sorted order,
 * creates _migrations table if not exists, skips already-applied files.
 *
 * Each migration + _migrations insert runs in a single transaction
 * (PG supports transactional DDL). If the process dies mid-migration,
 * the migration is rolled back and can be re-run safely.
 *
 * Usage: npm run migrate
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getPoolConfigFromEnv } from './pool-config-env';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

async function run(): Promise<void> {
  const pool = new Pool(
    getPoolConfigFromEnv(process.env as Record<string, string | undefined>),
  );

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

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [
          filename,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
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
