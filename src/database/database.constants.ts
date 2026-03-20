/**
 * Injection token for the pg.Pool instance.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class MyService {
 *   constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
 *
 *   async findUser(id: string) {
 *     const { rows } = await this.pool.query(
 *       'SELECT * FROM users WHERE id = $1',
 *       [id],
 *     );
 *     return rows[0];
 *   }
 * }
 * ```
 */
export const DB_POOL = 'DB_POOL';
