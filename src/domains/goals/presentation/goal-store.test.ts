import { createGoalStore } from './goal-store';
import type { GoalService } from '../application/public';

it('STATE-003 preserves a committed goal when projection refresh fails and resets disposable history', async () => {
  const goal = {
    id: 'g',
    name: 'Fund',
    target: 100,
    startingSaved: 0,
    deadline: null,
    priority: 'high',
    desiredMonthly: null,
    state: 'active',
  };
  if (goal.priority !== 'high' || goal.state !== 'active') throw new Error('Invalid fixture');
  const service: GoalService = {
    /** Returns a deterministic committed record.
     * @param command Source test goal.
     * @returns The committed input.
     */
    saveGoal: async (command) => ({ ok: true, value: command.input }),
    /** Returns a deterministic committed contribution.
     * @param command Source test contribution.
     * @returns The committed input.
     */
    saveContribution: async (command) => ({ ok: true, value: command.input }),
    /** Completes a deterministic deletion.
     * @returns Successful completion.
     */
    removeContribution: async () => ({ ok: true, value: undefined }),
    /** Simulates a source read failure after a successful write.
     * @returns A retryable read failure.
     */
    readGoals: async () => ({
      ok: false,
      error: { code: 'read-failed', message: 'Reload goals.' },
    }),
  };
  const store = createGoalStore(service);
  const result = await store.getState().saveGoal({
    operationId: 'save',
    input: { ...goal, priority: goal.priority, state: goal.state },
  });
  expect(result.ok).toBe(true);
  expect(store.getState()).toMatchObject({
    status: 'stale',
    message: 'Saved. Unable to refresh goals. Reload to see current progress.',
  });
  store.getState().reset();
  expect(store.getState()).toMatchObject({ goals: [], status: 'idle', message: '' });
});
