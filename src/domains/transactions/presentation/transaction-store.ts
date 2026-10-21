import { createStore } from 'zustand/vanilla';
import type { Command, Result } from '@/shared/domain/result';
import type { Transaction, TransactionService, MonthlyActuals } from '../application/public';

/** Disposable history, filters, and totals with explicit stale status after committed writes. */
export type TransactionState = {
  readonly month: string;
  readonly records: readonly Transaction[];
  readonly summary: MonthlyActuals | null;
  readonly nextCursor: string | null;
  readonly filter: 'all' | 'income' | 'expense';
  readonly status: 'idle' | 'loading' | 'ready' | 'error' | 'stale';
  readonly message: string;
  readonly loadMonth: (month: string) => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly save: (command: Command<Transaction>) => Promise<Result<Transaction>>;
  readonly remove: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  readonly setFilter: (filter: TransactionState['filter']) => void;
  readonly reset: () => void;
};

/** Owns disposable history without turning a failed refresh into a failed financial mutation.
 * @param service Validated financial entry use cases.
 * @returns Provider-scoped vanilla store with bounded pagination and reset.
 */
export const createTransactionStore = (service: TransactionService) =>
  createStore<TransactionState>()((set, get) => {
    let generation = 0;
    let lifecycle = 0;
    /** Loads a fresh page and totals while preserving prior data if refresh fails.
     * @param month Calendar month selected by the user.
     * @param committed Whether this read follows an already successful durable mutation.
     * @returns Completion after publishing current data or a truthful stale/error state.
     */
    const refresh = async (month: string, committed: boolean) => {
      const request = ++generation;
      const sameMonth = get().month === month;
      set({
        month,
        status: 'loading',
        message: '',
        ...(sameMonth ? {} : { records: [], summary: null, nextCursor: null }),
      });
      try {
        const [page, summary] = await Promise.all([
          service.list({ month, cursor: null, limit: 40 }),
          service.summary(month),
        ]);
        if (request !== generation) return;
        if (!page.ok || !summary.ok) {
          const detail = !page.ok ? page.error.message : !summary.ok ? summary.error.message : '';
          set({
            ...(page.ok
              ? { records: page.value.records, nextCursor: page.value.nextCursor, summary: null }
              : {}),
            status: committed || page.ok || get().records.length ? 'stale' : 'error',
            message: committed
              ? 'Saved. Unable to refresh the history. Reload to see the latest records.'
              : detail,
          });
          return;
        }
        set({
          records: page.value.records,
          nextCursor: page.value.nextCursor,
          summary: summary.value,
          status: 'ready',
          message: '',
        });
      } catch {
        if (request === generation)
          set({
            status: committed || get().records.length ? 'stale' : 'error',
            message: committed
              ? 'Saved. Unable to refresh the history. Reload to see the latest records.'
              : 'Unable to refresh this month. Try again.',
          });
      }
    };
    return {
      month: '',
      records: [],
      summary: null,
      nextCursor: null,
      filter: 'all',
      status: 'idle',
      message: '',
      /** Loads the first page and actual totals for one calendar month.
       * @param month Valid calendar month selected by the user.
       * @returns Completion after publishing a projection or recoverable read error.
       */
      loadMonth: async (month) => {
        await refresh(month, false);
      },
      /** Appends one exclusive keyset page; duplicate in-flight loads are ignored.
       * @returns Completion; changed data requires an explicit full reload.
       */
      loadMore: async () => {
        const current = get();
        if (
          (current.status !== 'ready' &&
            !(current.status === 'stale' && current.summary === null)) ||
          !current.nextCursor
        )
          return;
        const request = generation;
        set({ status: 'loading', message: '' });
        try {
          const page = await service.list({
            month: current.month,
            cursor: current.nextCursor,
            limit: 40,
          });
          if (request !== generation) return;
          if (!page.ok) {
            set({ status: 'stale', nextCursor: null, message: page.error.message });
            return;
          }
          const records = new Map(current.records.map((record) => [record.id, record]));
          page.value.records.forEach((record) => {
            records.set(record.id, record);
          });
          set({
            records: [...records.values()],
            nextCursor: page.value.nextCursor,
            status: 'ready',
          });
        } catch {
          if (request === generation)
            set({ status: 'stale', message: 'Unable to load more records. Reload this month.' });
        }
      },
      /** Preserves retry identity and refreshes the currently selected month after a commit.
       * @param command Stable save action and canonical source record.
       * @returns The durable outcome, independently of projection refresh success.
       */
      save: async (command) => {
        const owner = lifecycle;
        const result = await service.save(command);
        if (result.ok && owner === lifecycle)
          await refresh(get().month || result.value.date.slice(0, 7), true);
        return result;
      },
      /** Preserves successful deletion even when refreshing its projection fails.
       * @param command Stable deletion action and record identity.
       * @returns The durable deletion outcome.
       */
      remove: async (command) => {
        const owner = lifecycle;
        const result = await service.remove(command);
        if (result.ok && owner === lifecycle && get().month) await refresh(get().month, true);
        return result;
      },
      /** Changes a view-only filter without persisting another source of financial truth.
       * @param filter Income, expense, or all loaded entries.
       */
      setFilter: (filter) => {
        set({ filter });
      },
      /** Invalidates pending reads/writes and discards projections after teardown or restore. */
      reset: () => {
        lifecycle += 1;
        generation += 1;
        set({
          month: '',
          records: [],
          summary: null,
          nextCursor: null,
          filter: 'all',
          status: 'idle',
          message: '',
        });
      },
    };
  });
