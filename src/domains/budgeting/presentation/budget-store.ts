import { createStore } from 'zustand/vanilla';
import type { BudgetService, Category, PlanVersion } from '../application/public';

/** Replaceable plan projections, separate from local drafts and SQLite's source records. */
export type BudgetState = {
  readonly month: string;
  readonly version: PlanVersion | null;
  readonly categories: readonly Category[];
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly message: string;
  readonly loadMonth: (month: string) => Promise<void>;
  readonly reset: () => void;
};

/** Creates a scoped projection store with latest-request-wins loading and reset.
 * @param service Application operations backed by durable budget persistence.
 * @returns Vanilla store without a second persisted copy of financial data.
 */
export const createBudgetStore = (service: BudgetService) => {
  let generation = 0;
  return createStore<BudgetState>()((set) => ({
    month: '',
    version: null,
    categories: [],
    status: 'idle',
    message: '',
    /** Loads independent projections and ignores stale completions after another request.
     * @param month Calendar month requested by the user.
     * @returns Completion after publishing a validated projection or sanitized error.
     */
    loadMonth: async (month) => {
      const request = ++generation;
      set({ month, version: null, categories: [], status: 'loading', message: '' });
      const [version, categories] = await Promise.all([
        service.readMonth(month),
        service.readCategories(),
      ]);
      if (request !== generation) return;
      if (!version.ok) {
        set({ status: 'error', message: version.error.message });
        return;
      }
      if (!categories.ok) {
        set({ status: 'error', message: categories.error.message });
        return;
      }
      set({ version: version.value, categories: categories.value, status: 'ready' });
    },
    /** Invalidates pending reads and discards loaded records after teardown or restore. */
    reset: () => {
      generation += 1;
      set({ month: '', version: null, categories: [], status: 'idle', message: '' });
    },
  }));
};
