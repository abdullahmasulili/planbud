import type {
  DatabaseHandle,
  SqlExecutor,
  SqlRow,
  SqlValue,
} from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import { readCommand, recordCommand } from '@/shared/infrastructure/database/command-log';
import { parseDate } from '@/shared/domain/calendar-date';
import { isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import type { TransactionPort } from '../application/transaction-service';
import { parseTransaction } from '../domain/transaction';
import type { Transaction } from '../domain/transaction';
import { summarizeTransactions } from '../domain/summary';

const SELECT_RECORDS =
  'SELECT id,type,amount,record_date AS date,category_id AS categoryId,note FROM transactions';

/** Rejects damaged raw rows through the owning financial record contract.
 * @param row Untrusted SQLite projection or cached command result.
 * @returns A validated transaction; rejects malformed persisted data.
 */
const decodeTransaction = (row: unknown): Transaction => {
  const parsed = parseTransaction(row);
  if (!parsed.ok) throw new Error('Invalid stored transaction.');
  return parsed.value;
};

/** Reads one source record without opening a nested transaction.
 * @param sql Current transaction capability.
 * @param id Stable transaction identity.
 * @returns Validated source record or absence.
 */
const readTransaction = async (sql: SqlExecutor, id: string): Promise<Transaction | null> => {
  const row = await sql.first(`${SELECT_RECORDS} WHERE id=?`, [id]);
  return row ? decodeTransaction(row) : null;
};

/** Requires a confirmed currency before recording financial activity.
 * @param sql Current transaction capability.
 * @returns Completion or a rejected unconfirmed-profile operation.
 */
const requireProfile = async (sql: SqlExecutor) => {
  if (!(await sql.first('SELECT id FROM profiles WHERE singleton=1')))
    throw new Error('Confirm currency before recording transactions.');
};

/** Decodes a bounded opaque cursor tied to its month and source-data revision.
 * @param encoded Untrusted cursor text, or first-page absence.
 * @param month Requested calendar month.
 * @param revision Current consistent source revision.
 * @returns The exclusive date/ID boundary or null for a fresh page.
 */
const decodeCursor = (
  encoded: string | null,
  month: string,
  revision: number,
): { date: string; id: string } | null => {
  if (encoded === null) return null;
  if (encoded.length > 500) throw new Error('Invalid history cursor.');
  const parsed: unknown = JSON.parse(encoded);
  if (!Array.isArray(parsed) || parsed.length !== 4) throw new Error('Invalid history cursor.');
  const values: readonly unknown[] = parsed;
  const [cursorMonth, date, id, version] = values;
  if (
    cursorMonth !== month ||
    typeof date !== 'string' ||
    !parseDate(date).ok ||
    !isText(id, MAX_ID_LENGTH) ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw new Error('Invalid history cursor.');
  if (version !== revision)
    throw Object.assign(new Error('History inputs changed.'), { code: 'stale-data' });
  return { date, id };
};

/** Reads validated monthly source records for a consistent summary or snapshot composition.
 * @param sql Existing read transaction owned by composition or this repository.
 * @param month Calendar month selected by the application boundary.
 * @returns Ordered source records; no goal-contribution table is consulted.
 */
export const readMonthlyTransactions = async (
  sql: SqlExecutor,
  month: string,
): Promise<readonly Transaction[]> => {
  const rows = await sql.all(
    `${SELECT_RECORDS} WHERE substr(record_date,1,7)=? ORDER BY record_date DESC,id DESC`,
    [month],
  );
  return rows.map(decodeTransaction);
};

/** Implements record changes and their replay log as one serialized SQLite transaction.
 * @param database Private lifecycle-owned database handle.
 * @returns Durable transaction use-case port without leaking SQL to presentation.
 */
export const createTransactionRepository = (database: DatabaseHandle): TransactionPort => ({
  /** Applies one validated source record and caches its result atomically.
   * @param command Stable operation identity and canonical transaction input.
   * @returns Original replay result or committed source record.
   */
  save: async (command) => {
    const input = decodeTransaction(command.input);
    return await database.write(async (sql) => {
      await requireProfile(sql);
      const replay = await readCommand(sql, command.operationId, 'transaction.save', input);
      if (replay.found) return { value: decodeTransaction(replay.value), changed: false };
      const existing = await readTransaction(sql, input.id);
      if (input.type === 'expense') {
        const category = await sql.first('SELECT archived FROM categories WHERE id=?', [
          input.categoryId,
        ]);
        if (
          !category ||
          (category.archived !== 0 &&
            !(category.archived === 1 && existing?.categoryId === input.categoryId))
        )
          throw Object.assign(new Error('Expense category is unavailable.'), {
            code: 'invalid-reference',
          });
      }
      const changed = !existing || JSON.stringify(existing) !== JSON.stringify(input);
      const prospective = (await readMonthlyTransactions(sql, input.date.slice(0, 7))).filter(
        (record) => record.id !== input.id,
      );
      if (!summarizeTransactions([...prospective, input]).ok)
        throw Object.assign(
          new Error('Monthly totals exceed the supported range. Reduce the amount.'),
          { code: 'amount-overflow' },
        );
      if (changed)
        await sql.execute(
          'INSERT INTO transactions(id,type,amount,record_date,category_id,note) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,amount=excluded.amount,record_date=excluded.record_date,category_id=excluded.category_id,note=excluded.note',
          [input.id, input.type, input.amount, input.date, input.categoryId, input.note],
        );
      await recordCommand(sql, command.operationId, 'transaction.save', input, input);
      return { value: input, changed };
    });
  },
  /** Deletes a source record once; replay metadata alone does not advance financial revision.
   * @param command Stable deletion identity and target source record.
   * @returns Completion without resurrecting an earlier deleted record on retry.
   */
  remove: async (command) => {
    await database.write(async (sql) => {
      await requireProfile(sql);
      const input = { id: command.input.id };
      const replay = await readCommand(sql, command.operationId, 'transaction.remove', input);
      if (replay.found) {
        if (replay.value !== null) throw new Error('Invalid cached deletion result.');
        return { value: undefined, changed: false };
      }
      const existing = await readTransaction(sql, input.id);
      if (existing) await sql.execute('DELETE FROM transactions WHERE id=?', [input.id]);
      await recordCommand(sql, command.operationId, 'transaction.remove', input, null);
      return { value: undefined, changed: existing !== null };
    });
  },
  /** Reads a bounded keyset page under one consistent revision.
   * @param query Validated month, page size, and optional opaque cursor.
   * @returns Stable descending date/ID records with an exclusive continuation.
   */
  list: async (query) =>
    await database.read(async (sql) => {
      const revision = await readRevision(sql);
      const cursor = decodeCursor(query.cursor, query.month, revision);
      const values: SqlValue[] = [query.month];
      let predicate = 'substr(record_date,1,7)=?';
      if (cursor) {
        predicate += ' AND (record_date < ? OR (record_date = ? AND id < ?))';
        values.push(cursor.date, cursor.date, cursor.id);
      }
      values.push(query.limit + 1);
      const rows: readonly SqlRow[] = await sql.all(
        `${SELECT_RECORDS} WHERE ${predicate} ORDER BY record_date DESC,id DESC LIMIT ?`,
        values,
      );
      const records = rows.slice(0, query.limit).map(decodeTransaction);
      const last = records.at(-1);
      return {
        records,
        nextCursor:
          rows.length > query.limit && last
            ? JSON.stringify([query.month, last.date, last.id, revision])
            : null,
      };
    }),
  /** Derives actual totals from this domain's source records inside one read transaction.
   * @param month Requested calendar month.
   * @returns Exact totals; rejects corrupted source rows or unsafe aggregate arithmetic.
   */
  summary: async (month) =>
    await database.read(async (sql) => {
      const result = summarizeTransactions(await readMonthlyTransactions(sql, month));
      if (!result.ok)
        throw Object.assign(new Error('Monthly totals exceed the supported range.'), {
          code: 'amount-overflow',
        });
      return result.value;
    }),
});
