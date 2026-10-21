import { DatabaseSync } from 'node:sqlite';
import type { DatabaseAdapter, SqlExecutor } from '@/shared/infrastructure/database/connection';

/** Creates a real host SQLite adapter for repository contracts, not native acceptance.
 * @param filename In-memory by default, or a temporary persistence-test file.
 * @returns An adapter using actual SQLite constraints and rollback.
 */
export const createHostDatabase = (filename = ':memory:'): DatabaseAdapter => {
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON');
  const executor: SqlExecutor = {
    /** Executes a parameterized statement.
     * @param sql Statement text.
     * @param parameters Bound values, never interpolated.
     * @returns Completion of the statement.
     */
    execute: async (sql, parameters = []) => {
      database.prepare(sql).run(...parameters);
    },
    /** Reads one raw SQLite row.
     * @param sql Select statement.
     * @param parameters Bound values.
     * @returns A row or null when absent.
     */
    first: async (sql, parameters = []) => database.prepare(sql).get(...parameters) ?? null,
    /** Reads all raw SQLite rows for a bounded query.
     * @param sql Select statement.
     * @param parameters Bound values.
     * @returns Rows from the actual host SQLite engine.
     */
    all: async (sql, parameters = []) => database.prepare(sql).all(...parameters),
    /** Executes trusted migration statements.
     * @param sql Schema script owned by the application.
     * @returns Completion of schema execution.
     */
    batch: async (sql) => {
      database.exec(sql);
    },
  };
  return {
    /** Commits only successful work and rolls back a rejected transaction.
     * @param work Operation using this transaction's executor.
     * @returns The committed operation value.
     */
    transaction: async (work) => {
      database.exec('BEGIN IMMEDIATE');
      try {
        const value = await work(executor);
        database.exec('COMMIT');
        return value;
      } catch (error) {
        try {
          database.exec('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'Database operation and rollback failed.',
          );
        }
        throw error;
      }
    },
    /** Closes the isolated host connection.
     * @returns Completion after SQLite releases its resources.
     */
    close: async () => {
      database.close();
    },
  };
};
