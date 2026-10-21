import type { Command, Result } from '@/shared/domain/result';
import type { MonthKey } from '@/shared/domain/calendar-date';
import { parseDate } from '@/shared/domain/calendar-date';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import { isText } from '@/shared/domain/validation';
import { parseTransaction } from '../domain/transaction';
import type { Transaction } from '../domain/transaction';
import type { MonthlyActuals } from '../domain/summary';

/** Bounded keyset page request; cursors are opaque and tied to a consistent data revision. */
export type TransactionQuery = {
  readonly month: MonthKey;
  readonly cursor: string | null;
  readonly limit: number;
};
/** Stable date/ID ordered records and an opaque continuation cursor. */
export type TransactionPage = {
  readonly records: readonly Transaction[];
  readonly nextCursor: string | null;
};
/** Durable atomic transaction operations, including command replay and derived reads. */
export type TransactionPort = {
  readonly save: (command: Command<Transaction>) => Promise<Transaction>;
  readonly remove: (command: Command<{ readonly id: string }>) => Promise<void>;
  readonly list: (query: TransactionQuery) => Promise<TransactionPage>;
  readonly summary: (month: MonthKey) => Promise<MonthlyActuals>;
};
/** Sanitized financial entry use cases consumed by histories and overview projections. */
export type TransactionService = {
  readonly save: (command: Command<Transaction>) => Promise<Result<Transaction>>;
  readonly remove: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  readonly list: (query: TransactionQuery) => Promise<Result<TransactionPage>>;
  readonly summary: (month: MonthKey) => Promise<Result<MonthlyActuals>>;
};

/** Checks calendar month syntax without assigning records through UTC conversion.
 * @param month Requested month key.
 * @returns Whether the key identifies a real Gregorian calendar month.
 */
const validMonth = (month: string) => /^\d{4}-\d{2}$/.test(month) && parseDate(month + '-01').ok;

/** Translates storage/command failures once without leaking records or native diagnostics.
 * @param error Unknown infrastructure rejection.
 * @returns Actionable typed failure preserving retry and stale-page distinctions.
 */
const operationFailure = (error: unknown): Result<never> => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 'command-conflict')
    return {
      ok: false,
      error: {
        code,
        message: 'This action was already used for different data. Reopen the form and try again.',
      },
    };
  if (code === 'stale-data')
    return {
      ok: false,
      error: { code, message: 'Records changed. Reload this month to continue.' },
    };
  if (code === 'invalid-reference')
    return { ok: false, error: { code, message: 'Choose an active category for this expense.' } };
  if (code === 'amount-overflow')
    return {
      ok: false,
      error: {
        code,
        message: 'This total exceeds the supported amount range. Review the recorded amounts.',
      },
    };
  return {
    ok: false,
    error: {
      code: 'transactions-unavailable',
      message: 'Unable to save or load transactions. Try again.',
    },
  };
};

/** Validates entry commands, bounded reads, and month summaries at the application boundary.
 * @param port Durable transaction capability with atomic idempotency semantics.
 * @returns Framework-independent use cases with sanitized outcomes.
 */
export const createTransactionService = (port: TransactionPort): TransactionService => ({
  /** Applies one canonical entry command; the operation ID stays stable across retries.
   * @param command Positive source record and stable user-action identity.
   * @returns The committed record, or an input/storage/replay conflict.
   */
  save: async (command) => {
    const parsed = parseTransaction(command.input);
    if (!parsed.ok) return parsed;
    if (!isText(command.operationId, MAX_ID_LENGTH))
      return {
        ok: false,
        error: { code: 'invalid-command', message: 'Reopen the form before saving.' },
      };
    try {
      return {
        ok: true,
        value: await port.save({ operationId: command.operationId, input: parsed.value }),
      };
    } catch (error) {
      return operationFailure(error);
    }
  },
  /** Removes one entry without applying a repeated command twice.
   * @param command Record identity and stable deletion operation ID.
   * @returns Completion or an actionable validation/storage failure.
   */
  remove: async (command) => {
    if (!isText(command.operationId, MAX_ID_LENGTH) || !isText(command.input.id, MAX_ID_LENGTH))
      return {
        ok: false,
        error: { code: 'invalid-command', message: 'Reload the record before deleting.' },
      };
    try {
      await port.remove({ operationId: command.operationId, input: { id: command.input.id } });
      return { ok: true, value: undefined };
    } catch (error) {
      return operationFailure(error);
    }
  },
  /** Loads a bounded page without mixing cursors from changed datasets.
   * @param query Month, opaque continuation, and page size from 1 through 100.
   * @returns Ordered records and continuation, or an invalid/stale/storage failure.
   */
  list: async (query) => {
    if (
      !validMonth(query.month) ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100 ||
      (query.cursor !== null && (typeof query.cursor !== 'string' || query.cursor.length > 500))
    )
      return {
        ok: false,
        error: { code: 'invalid-query', message: 'Choose a valid month and reload the history.' },
      };
    try {
      return { ok: true, value: await port.list(query) };
    } catch (error) {
      return operationFailure(error);
    }
  },
  /** Reads actual activity separately from planned estimates and goal earmarking.
   * @param month Valid calendar month to summarize.
   * @returns Exact source-derived totals or a sanitized read/overflow failure.
   */
  summary: async (month) => {
    if (!validMonth(month))
      return {
        ok: false,
        error: { code: 'invalid-query', message: 'Choose a valid calendar month.' },
      };
    try {
      return { ok: true, value: await port.summary(month) };
    } catch (error) {
      return operationFailure(error);
    }
  },
});
