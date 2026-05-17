import 'dotenv/config';

/**
 * Production-safe runner: inserts only fake demo players from
 * `database/seeds/006_seed_fake_players.sql` for the tenant slugs you specify.
 * Idempotent: ON CONFLICT (tenant_id, email) DO NOTHING.
 *
 * Env: DB_* (see database/pool-config-env.ts).
 * Tenants (required), either:
 *   - CLI: pnpm seed:fake-players -- acfc downtown
 *   - Env: SEED_FAKE_PLAYERS_TENANTS=acfc,downtown pnpm seed:fake-players
 * CLI slugs override SEED_FAKE_PLAYERS_TENANTS when both are set.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getPoolConfigFromEnv } from './pool-config-env';

const SEED_SQL_PATH = path.join(
  __dirname,
  'seeds',
  '006_seed_fake_players.sql',
);
const JOIN_ON = 'ON t.slug = v.tenant_slug';
const JOIN_ON_FILTERED =
  'ON t.slug = v.tenant_slug AND v.tenant_slug = ANY($1::text[])';

function parseTenantSlugs(): string[] {
  const fromArgv = process.argv
    .slice(2)
    .filter((a) => a !== '--')
    .flatMap((a) => a.split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  const fromEnv = (process.env.SEED_FAKE_PLAYERS_TENANTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const raw = fromArgv.length > 0 ? fromArgv : fromEnv;
  return [...new Set(raw)];
}

async function run(): Promise<void> {
  const slugs = parseTenantSlugs();
  if (slugs.length === 0) {
    console.error(
      'No tenant slugs. Examples:\n' +
        '  pnpm seed:fake-players -- acfc downtown\n' +
        '  SEED_FAKE_PLAYERS_TENANTS=acfc,downtown pnpm seed:fake-players',
    );
    process.exit(1);
  }

  let sqlRaw: string;
  try {
    sqlRaw = fs.readFileSync(SEED_SQL_PATH, 'utf8');
  } catch (e) {
    console.error(`Failed to read ${SEED_SQL_PATH}:`, e);
    process.exit(1);
  }

  if (!sqlRaw.includes(JOIN_ON)) {
    throw new Error(
      `Expected "${JOIN_ON}" in 006_seed_fake_players.sql; update ${path.basename(__filename)} if the seed file changed.`,
    );
  }

  const sql = sqlRaw.replace(JOIN_ON, JOIN_ON_FILTERED);

  const pool = new Pool(
    getPoolConfigFromEnv(process.env as Record<string, string | undefined>),
  );
  const client = await pool.connect();

  try {
    const { rows } = await client.query<{ slug: string }>(
      'SELECT slug FROM tenants WHERE slug = ANY($1::text[])',
      [slugs],
    );
    const found = new Set(rows.map((r) => r.slug));
    const missing = slugs.filter((s) => !found.has(s));
    if (missing.length > 0) {
      console.error(`Unknown tenant slug(s): ${missing.join(', ')}`);
      process.exit(1);
    }

    const result = await client.query(sql, [slugs]);
    console.log(
      `[seed:fake-players] tenants=${slugs.join(',')} inserted_rows=${result.rowCount ?? 0}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('seed:fake-players failed:', err);
  process.exit(1);
});
