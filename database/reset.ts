import 'dotenv/config';

/**
 * Wipes the public schema (all tables, types, etc.) for a clean dev reset.
 * Run before migrate + seed. Uses same env as migrate/seed (DB_*).
 *
 * Usage: npm run db:reset (via package.json)
 */
import { Pool } from 'pg';
import { getPoolConfigFromEnv } from './pool-config-env';

async function run(): Promise<void> {
  const pool = new Pool(
    getPoolConfigFromEnv(process.env as Record<string, string | undefined>),
  );

  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    await client.query('GRANT ALL ON SCHEMA public TO PUBLIC');
    console.log('[db reset] public schema recreated');
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('DB reset failed:', err);
    process.exit(1);
  });
