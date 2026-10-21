import { buildOverview } from './overview';

it('MONEY-003 keeps planned estimates independent of recorded activity', () => {
  const result = buildOverview(
    { month: '2026-10', plannedIncome: 100000, limits: [{ categoryId: 'food', amount: 60000 }] },
    [{ id: 'food', name: 'Food', kind: 'essential', archived: false }],
    { income: 95000, spending: 65000, byCategory: [{ categoryId: 'food', amount: 65000 }] },
  );
  expect(result).toMatchObject({
    ok: true,
    value: {
      plannedIncome: 100000,
      actualIncome: 95000,
      plannedSpending: 60000,
      actualSpending: 65000,
      remainingSpending: -5000,
      categories: [{ remaining: -5000 }],
    },
  });
});
it('MONEY-001 rejects overflowing limits and inconsistent source summaries', () => {
  const plan = {
    month: '2026-10',
    plannedIncome: 0,
    limits: [
      { categoryId: 'a', amount: Number.MAX_SAFE_INTEGER },
      { categoryId: 'b', amount: 1 },
    ],
  };
  expect(buildOverview(plan, [], { income: 0, spending: 0, byCategory: [] }).ok).toBe(false);
  expect(
    buildOverview({ ...plan, limits: [] }, [], { income: 0, spending: 100, byCategory: [] }).ok,
  ).toBe(false);
});
