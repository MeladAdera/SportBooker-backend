import 'dotenv/config';

/**
 * Seed runner. Executes .sql files from database/seeds/ in filename order.
 * Seeds are idempotent (INSERT ... ON CONFLICT DO NOTHING).
 *
 * IMPORTANT: Run migrations first (npm run migrate), then seeds (npm run seed).
 *
 * Usage: npm run seed
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getPoolConfigFromEnv } from './pool-config-env';

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function run(): Promise<void> {
  const pool = new Pool(
    getPoolConfigFromEnv(process.env as Record<string, string | undefined>),
  );

  const client = await pool.connect();

  try {
    const files = fs
      .readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const filePath = path.join(SEEDS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      console.log(`[seeded] ${filename}`);
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
    console.error('Seed failed:', err);
    process.exit(1);
  });
