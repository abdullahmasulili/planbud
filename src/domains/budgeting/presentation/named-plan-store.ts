import { createStore } from 'zustand/vanilla';
import type { NamedPlanService, NamedPlanVersion } from '../application/public';

/** Disposable source projection; local editing drafts remain owned by their form. */
export type NamedPlanState = {
  readonly version: NamedPlanVersion | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly message: string;
  readonly load: () => Promise<void>;
  readonly reset: () => void;
};
/** Creates a provider-scoped named-plan list with stale-read and profile-reset protection.
 * @param service Validated source reads.
 * @returns Vanilla projection store; SQLite remains the only persisted copy.
 */
export const createNamedPlanStore = (service: NamedPlanService) => {
  let generation = 0;
  return createStore<NamedPlanState>()((set) => ({
    version: null,
    status: 'idle',
    message: '',
    /** Refreshes all named plans without letting an older request overwrite new state.
     * @returns Completion after publishing a result or recoverable failure.
     */
    load: async () => {
      const request = ++generation;
      set({ status: 'loading', message: '' });
      const result = await service.read();
      if (request !== generation) return;
      if (result.ok) set({ version: result.value, status: 'ready' });
      else set({ version: null, status: 'error', message: result.error.message });
    },
    /** Disposes records and invalidates in-flight reads on teardown or profile replacement. */
    reset: () => {
      generation += 1;
      set({ version: null, status: 'idle', message: '' });
    },
  }));
};
