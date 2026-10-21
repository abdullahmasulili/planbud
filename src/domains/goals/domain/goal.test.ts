import { parseGoal, goalProgress } from './goal';
import type { Goal } from './goal';
import { parseContribution } from './contribution';

const goal: Goal = {
  id: 'emergency',
  name: 'Emergency fund',
  target: 10000,
  startingSaved: 2000,
  deadline: '2026-09-30',
  priority: 'high',
  desiredMonthly: null,
  state: 'active',
};

it('GOAL-001 validates positive targets and exact starting amounts without requiring a deadline', () => {
  expect(parseGoal(goal)).toMatchObject({ ok: true });
  expect(parseGoal({ ...goal, target: 0 })).toMatchObject({ ok: false });
  expect(parseGoal({ ...goal, startingSaved: -1 })).toMatchObject({ ok: false });
  expect(parseGoal({ ...goal, deadline: '2026-02-30' })).toMatchObject({ ok: false });
  expect(parseGoal({ ...goal, deadline: null, desiredMonthly: null })).toMatchObject({ ok: true });
  expect(parseGoal({ ...goal, desiredMonthly: 0 })).toMatchObject({ ok: false });
  expect(
    parseContribution({ id: 'a', goalId: goal.id, amount: 0, date: '2026-10-20' }),
  ).toMatchObject({ ok: false });
});

it('DSS-002 derives savings, clamps remaining and identifies overdue active goals without fabricating funds', () => {
  const contributions = [{ id: 'a', goalId: goal.id, amount: 9000, date: '2026-10-20' }];
  expect(goalProgress(goal, contributions, '2026-10-20')).toMatchObject({
    ok: true,
    value: { saved: 11000, remaining: 0, overdue: false },
  });
  expect(goalProgress(goal, [], '2026-10-20')).toMatchObject({
    ok: true,
    value: { saved: 2000, remaining: 8000, overdue: true },
  });
  expect(goalProgress({ ...goal, state: 'completed' }, [], '2026-10-20')).toMatchObject({
    ok: true,
    value: { saved: 2000, remaining: 8000, overdue: false },
  });
  expect(goalProgress({ ...goal, deadline: null }, [], '2026-10-20')).toMatchObject({
    ok: true,
    value: { overdue: false },
  });
  expect(
    goalProgress({ ...goal, startingSaved: Number.MAX_SAFE_INTEGER }, contributions, '2026-10-20'),
  ).toMatchObject({ ok: false });
  expect(
    goalProgress(
      goal,
      [{ ...contributions[0], id: 'wrong', goalId: 'other', amount: 1, date: '2026-10-20' }],
      '2026-10-20',
    ),
  ).toMatchObject({ ok: false });
});
