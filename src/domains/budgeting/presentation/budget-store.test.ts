import { createBudgetStore } from './budget-store';
import { createBudgetService } from '../application/budget-service';
import type { PlanVersion } from '../application/public';

it('STATE-003 ignores an older month read and invalidates projections on reset', async () => {
  let finishOctober: ((version: PlanVersion) => void) | undefined;
  const october = new Promise<PlanVersion>((resolve) => {
    finishOctober = resolve;
  });
  const service = createBudgetService({
    /** Delays October to expose stale completion ordering.
     * @param month Requested month.
     * @returns Versioned empty estimate.
     */
    readMonth: async (month) =>
      month === '2026-10'
        ? await october
        : { plan: { month, plannedIncome: 0, limits: [] }, revision: 2 },
    /** Supplies the empty test category projection.
     * @returns No categories.
     */
    readCategories: async () => [],
    /** Echoes a category for this store-only test.
     * @param category Test input.
     * @returns The category projection.
     */
    saveCategory: async (category) => category,
    /** Echoes a saved plan without introducing storage into this contract.
     * @param input Test plan mutation.
     * @returns The versioned test projection.
     */
    savePlan: async (input) => ({ plan: input.plan, revision: input.expectedRevision + 1 }),
  });
  const store = createBudgetStore(service);
  const pending = store.getState().loadMonth('2026-10');
  await store.getState().loadMonth('2026-11');
  finishOctober?.({ plan: { month: '2026-10', plannedIncome: 0, limits: [] }, revision: 1 });
  await pending;
  expect(store.getState().version?.plan.month).toBe('2026-11');
  store.getState().reset();
  expect(store.getState().version).toBeNull();
  expect(store.getState().categories).toEqual([]);
});
