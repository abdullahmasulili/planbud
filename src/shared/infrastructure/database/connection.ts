import type { SQLiteDatabase } from 'expo-sqlite';

/** SQL bind values supported by both native and contract-test adapters. */
export type SqlValue = string | number | null | Uint8Array;
/** Untrusted database output, validated by the owning repository. */
export type SqlRow = Readonly<Record<string, unknown>>;
/** Infrastructure-only query capability scoped to one transaction. */
export type SqlExecutor = {
  readonly execute: (sql: string, parameters?: readonly SqlValue[]) => Promise<void>;
  readonly first: (sql: string, parameters?: readonly SqlValue[]) => Promise<SqlRow | null>;
  readonly all: (sql: string, parameters?: readonly SqlValue[]) => Promise<readonly SqlRow[]>;
  readonly batch: (sql: string) => Promise<void>;
};
/** Native transaction lifecycle isolated from application use-case ports. */
export type DatabaseAdapter = {
  readonly transaction: <T>(work: (sql: SqlExecutor) => Promise<T>) => Promise<T>;
  readonly close: () => Promise<void>;
};
/** Database access serializing writes and advancing a committed data revision. */
export type DatabaseHandle = {
  readonly read: <T>(work: (sql: SqlExecutor) => Promise<T>) => Promise<T>;
  readonly schema: <T>(work: (sql: SqlExecutor) => Promise<T>) => Promise<T>;
  readonly write: <T>(
    work: (sql: SqlExecutor) => Promise<{ value: T; changed: boolean }>,
    options?: { readonly replaceSession: true },
  ) => Promise<T>;
  readonly revision: () => Promise<number>;
  readonly close: () => Promise<void>;
};

/** Wraps infrastructure operations without exposing SQLite to application contracts.
 * @param adapter Native or host SQLite adapter.
 * @returns A lifecycle-owned database handle.
 */
export const createDatabaseHandle = (adapter: DatabaseAdapter): DatabaseHandle => {
  let tail = Promise.resolve();
  let closed = false;
  let session = Symbol();
  /** Serializes connection ownership while always releasing the next waiter.
   * @param operation Work requiring sole ownership of this connection.
   * @returns The operation's result without leaking a rejected queue promise.
   */
  const serialize = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release: (() => void) | undefined;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
    }
  };
  /** Runs one transaction after the previous owner has released the connection.
   * @param work SQL-scoped operation; never reenter the database handle here.
   * @param afterCommit Optional synchronous session invalidation before the next waiter starts.
   * @returns Its committed value.
   */
  const transact = async <T>(
    work: (sql: SqlExecutor) => Promise<T>,
    afterCommit?: () => void,
  ): Promise<T> =>
    await serialize(async () => {
      if (closed) throw new Error('Database connection is closed.');
      const result = await adapter.transaction(work);
      afterCommit?.();
      return result;
    });
  /** Advances the revision only when a mutation actually changes durable data.
   * @param work Atomic mutation identifying whether it changed records.
   * @param options A destructive replacement invalidates mutations queued under the previous session.
   * @param options.replaceSession Whether successful commit starts a new financial editing session.
   * @returns Its public committed value.
   */
  const write = async <T>(
    work: (sql: SqlExecutor) => Promise<{ value: T; changed: boolean }>,
    options?: { readonly replaceSession: true },
  ): Promise<T> => {
    const owner = session;
    return await transact(
      async (sql) => {
        if (owner !== session)
          throw Object.assign(new Error('Local data was replaced. Reload before saving.'), {
            code: 'stale-data',
          });
        const before = await readRevision(sql);
        const outcome = await work(sql);
        if (outcome.changed) {
          await sql.execute('UPDATE app_metadata SET revision = revision + 1 WHERE singleton = 1');
          if ((await readRevision(sql)) !== before + 1)
            throw new Error('Invalid database revision.');
        }
        return outcome.value;
      },
      () => {
        if (options?.replaceSession) session = Symbol();
      },
    );
  };
  /** Reads the committed revision without joining another operation's transaction.
   * @returns Current safe-integer revision.
   */
  const revision = async () => await transact(readRevision);
  /** Waits for queued operations before releasing the connection once.
   * @returns Completion or a native close failure.
   */
  const close = async () => {
    await serialize(async () => {
      if (!closed) {
        await adapter.close();
        closed = true;
      }
    });
  };
  return { read: transact, schema: transact, write, revision, close };
};

/** Reads a revision within the caller's existing transaction.
 * @param sql Transaction-scoped query capability.
 * @returns A validated revision, rejecting damaged metadata.
 */
export const readRevision = async (sql: SqlExecutor): Promise<number> => {
  const row = await sql.first('SELECT revision FROM app_metadata WHERE singleton = 1');
  const value = row?.revision;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid database revision.');
  return value;
};

/** Adapts native query results without trusting their application-level shape.
 * @param database Private Expo SQLite connection.
 * @returns The infrastructure query port.
 */
const nativeExecutor = (database: SQLiteDatabase): SqlExecutor => ({
  /** Executes SQL with bound values.
   * @param sql Trusted statement template.
   * @param parameters Bound values.
   * @returns Statement completion.
   */
  execute: async (sql, parameters = []) => {
    await database.runAsync(sql, [...parameters]);
  },
  /** Reads one raw row for the repository to validate.
   * @param sql Select statement.
   * @param parameters Bound values.
   * @returns Raw row or null.
   */
  first: async (sql, parameters = []) => await database.getFirstAsync<SqlRow>(sql, [...parameters]),
  /** Reads raw rows under the current transaction.
   * @param sql Bounded select statement.
   * @param parameters Bound values.
   * @returns Raw query rows.
   */
  all: async (sql, parameters = []) => await database.getAllAsync<SqlRow>(sql, [...parameters]),
  /** Executes trusted schema or transaction control statements.
   * @param sql Application-owned SQL script.
   * @returns Script completion.
   */
  batch: async (sql) => {
    await database.execAsync(sql);
  },
});

/** Opens a private native database with one serialized connection owner.
 * @param name Portable database basename; diagnostics must use a disposable namespace.
 * @returns The handle; callers migrate it before reading product records.
 */
export const openDatabase = async (name = 'plan-bud.db'): Promise<DatabaseHandle> => {
  if (!/^[a-z0-9-]+\.db$/.test(name)) throw new Error('Invalid database name.');
  const SQLite = await import('expo-sqlite');
  const database = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
  try {
    await database.execAsync(
      'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
  } catch (error) {
    try {
      await database.closeAsync();
    } catch (closeError) {
      throw new AggregateError([error, closeError], 'Database initialization and cleanup failed.');
    }
    throw error;
  }
  const executor = nativeExecutor(database);
  /** Owns transaction commit/rollback on the same foreign-key-enabled connection.
   * @param work Work scoped by the handle's serialization queue.
   * @returns The committed value or original failure with rollback context.
   */
  const transaction = async <T>(work: (sql: SqlExecutor) => Promise<T>): Promise<T> => {
    await database.execAsync('BEGIN IMMEDIATE');
    try {
      const result = await work(executor);
      await database.execAsync('COMMIT');
      return result;
    } catch (error) {
      try {
        await database.execAsync('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Database operation and rollback failed.');
      }
      throw error;
    }
  };
  /** Releases the native connection after the facade has drained its queue.
   * @returns Native close completion.
   */
  const close = async () => {
    await database.closeAsync();
  };
  return createDatabaseHandle({ transaction, close });
};
