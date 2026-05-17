import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Shared executor for `Pool` and `PoolClient` — both support parameterized `.query()`.
 * Use `PoolClient` when running queries inside an explicit transaction.
 */
export type DbExecutor = Pool | PoolClient;

/**
 * Thin infrastructure base: query execution + transaction wrapper.
 * Domain repositories extend this and keep SQL in one place per aggregate.
 */
export abstract class BaseRepository {
  constructor(protected readonly pool: Pool) {}

  /**
   * Parameterized query against the pool or a transaction client.
   */
  protected async query<T extends QueryResultRow = QueryResultRow>(
    executor: DbExecutor,
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return executor.query<T>(text, values);
  }

  /**
   * Runs `fn` inside BEGIN/COMMIT with automatic ROLLBACK on failure.
   * Prefer this over ad-hoc BEGIN in services so transaction boundaries stay in repositories.
   */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
