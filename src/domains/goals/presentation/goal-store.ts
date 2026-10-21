import { createStore } from 'zustand/vanilla';
import type { Command, Result } from '@/shared/domain/result';
import type { Goal, GoalProgress, GoalService, Contribution } from '../application/public';

/** Disposable source projections; durable records remain in SQLite. */
export type GoalState = {
  readonly goals: readonly GoalProgress[];
  readonly status: 'idle' | 'loading' | 'ready' | 'error' | 'stale';
  readonly message: string;
  readonly load: () => Promise<void>;
  readonly saveGoal: (command: Command<Goal>) => Promise<Result<Goal>>;
  readonly saveContribution: (command: Command<Contribution>) => Promise<Result<Contribution>>;
  readonly removeContribution: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  readonly reset: () => void;
};

/** Keeps source-write outcomes independent from a failed projection refresh.
 * @param service Validated goal use cases.
 * @returns Provider-scoped projections with request and lifecycle invalidation.
 */
export const createGoalStore = (service: GoalService) =>
  createStore<GoalState>()((set, get) => {
    let generation = 0;
    let lifecycle = 0;
    /** Replaces all goal projections from one consistent read.
     * @param committed Whether a durable mutation already succeeded.
     * @returns Completion with truthful ready, stale or error state.
     */
    const refresh = async (committed: boolean) => {
      const request = ++generation;
      set({ status: 'loading', message: '' });
      try {
        const result = await service.readGoals();
        if (request !== generation) return;
        if (result.ok) set({ goals: result.value, status: 'ready', message: '' });
        else
          set({
            status: committed || get().goals.length ? 'stale' : 'error',
            message: committed
              ? 'Saved. Unable to refresh goals. Reload to see current progress.'
              : result.error.message,
          });
      } catch {
        if (request === generation)
          set({
            status: committed || get().goals.length ? 'stale' : 'error',
            message: committed
              ? 'Saved. Unable to refresh goals. Reload to see current progress.'
              : 'Unable to load goals. Try again.',
          });
      }
    };
    return {
      goals: [],
      status: 'idle',
      message: '',
      /** Refreshes the disposable goal history.
       * @returns Completion after a current read or recoverable failure.
       */
      load: async () => await refresh(false),
      /** Saves metadata, retaining durable success if refresh fails.
       * @param command Stable metadata action.
       * @returns Durable save outcome.
       */
      saveGoal: async (command) => {
        const owner = lifecycle;
        const result = await service.saveGoal(command);
        if (result.ok && owner === lifecycle) await refresh(true);
        return result;
      },
      /** Saves actual earmarking separately from expense records.
       * @param command Stable source contribution action.
       * @returns Durable save outcome.
       */
      saveContribution: async (command) => {
        const owner = lifecycle;
        const result = await service.saveContribution(command);
        if (result.ok && owner === lifecycle) await refresh(true);
        return result;
      },
      /** Deletes actual earmarking and recomputes progress.
       * @param command Stable deletion action.
       * @returns Durable deletion outcome.
       */
      removeContribution: async (command) => {
        const owner = lifecycle;
        const result = await service.removeContribution(command);
        if (result.ok && owner === lifecycle) await refresh(true);
        return result;
      },
      /** Discards projections and rejects stale completions on teardown or restore. */
      reset: () => {
        lifecycle += 1;
        generation += 1;
        set({ goals: [], status: 'idle', message: '' });
      },
    };
  });
