import { readGoalAttention } from './goal-attention';
import type { GoalProgress } from '@/domains/goals/application/public';

it('UI-007 gives current overdue goals a bounded overview without hiding the full goal count', async () => {
  const goal: GoalProgress = {
    id: 'a',
    name: 'Fund',
    target: 100,
    startingSaved: 0,
    deadline: null,
    priority: 'high',
    desiredMonthly: 10,
    state: 'active',
    saved: 0,
    remaining: 100,
    overdue: false,
    contributions: [],
  };
  const result = await readGoalAttention({
    /** Supplies complete validated source projections.
     * @returns Active, overdue and completed goal fixtures.
     */ readGoals: async () => ({
      ok: true,
      value: [
        { ...goal, id: 'd' },
        { ...goal, id: 'c' },
        goal,
        { ...goal, id: 'overdue', overdue: true },
        { ...goal, id: 'done', state: 'completed' },
      ],
    }),
  });
  expect(result).toMatchObject({
    ok: true,
    value: { count: 4, goals: [{ id: 'overdue' }, { id: 'a' }, { id: 'c' }] },
  });
});
