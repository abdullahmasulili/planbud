import { parseMonthlyPlan } from './monthly-plan';
import { parseCategory } from './category';

it('MONEY-001 rejects individually safe limits whose combined amount is unsafe', () => {
  expect(
    parseMonthlyPlan({
      month: '2026-10',
      plannedIncome: 0,
      limits: [
        { categoryId: 'a', amount: Number.MAX_SAFE_INTEGER },
        { categoryId: 'b', amount: 1 },
      ],
    }),
  ).toMatchObject({ ok: false, error: { code: 'amount-overflow' } });
});

it('BUD-001 accepts zero budgets and independent calendar months', () => {
  const value = { month: '2026-10', plannedIncome: 0, limits: [{ categoryId: 'food', amount: 0 }] };
  expect(parseMonthlyPlan(value)).toEqual({ ok: true, value });
  expect(parseMonthlyPlan({ ...value, month: '2026-11' }).ok).toBe(true);
});
it.each([-1, Number.MAX_SAFE_INTEGER + 1, Infinity, 1.5])(
  'MONEY-001 rejects unsafe planned amount %s',
  (amount) => {
    expect(parseMonthlyPlan({ month: '2026-10', plannedIncome: amount, limits: [] }).ok).toBe(
      false,
    );
    expect(
      parseMonthlyPlan({
        month: '2026-10',
        plannedIncome: 1,
        limits: [{ categoryId: 'food', amount }],
      }).ok,
    ).toBe(false);
  },
);
it('BUD-001 rejects duplicate category limits and impossible months', () => {
  expect(
    parseMonthlyPlan({
      month: '2026-10',
      plannedIncome: 1,
      limits: [
        { categoryId: 'food', amount: 0 },
        { categoryId: 'food', amount: 1 },
      ],
    }).ok,
  ).toBe(false);
  expect(parseMonthlyPlan({ month: '2026-13', plannedIncome: 1, limits: [] }).ok).toBe(false);
});
it('BUD-002 validates category kind, name, and archive state', () => {
  expect(parseCategory({ id: 'food', name: 'Food', kind: 'essential', archived: false }).ok).toBe(
    true,
  );
  expect(parseCategory({ id: 'food', name: ' ', kind: 'essential', archived: false }).ok).toBe(
    false,
  );
  expect(parseCategory({ id: 'food', name: 'Food', kind: 'optional', archived: false }).ok).toBe(
    false,
  );
  expect(parseCategory({ id: 'food', name: 'Food', kind: 'essential', archived: 'false' }).ok).toBe(
    false,
  );
});
