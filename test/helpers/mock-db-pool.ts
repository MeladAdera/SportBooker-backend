import type { Pool } from 'pg';

/**
 * Minimal Pool mock for e2e tests that don't need a real DB.
 * Use with: .overrideProvider(DB_POOL).useValue(createMockDbPool())
 */
export function createMockDbPool(): Pool {
  const noop = (): void => {};
  const noopAsync = (): Promise<unknown> => Promise.resolve();
  return {
    connect: () =>
      Promise.resolve({
        query: () => Promise.resolve({ rows: [], command: '', rowCount: 0 }),
        release: noop,
      } as unknown as import('pg').PoolClient),
    query: () => Promise.resolve({ rows: [], command: '', rowCount: 0 }),
    end: noopAsync,
    on: () => ({}),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as Pool;
}
