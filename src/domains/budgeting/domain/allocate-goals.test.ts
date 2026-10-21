import { allocateGoals } from './allocate-goals';
import type { PlanningInput, PlanningGoal } from './allocate-goals';

const high: PlanningGoal = {
  id: 'a',
  state: 'active',
  remaining: 15000,
  deadline: '2026-10-31',
  priority: 'high',
  desiredMonthly: null,
};
const input: PlanningInput = {
  month: '2026-10',
  revision: 1,
  plannedIncome: 100000,
  categories: [
    { id: 'essential', kind: 'essential', limit: 60000, spent: 0 },
    { id: 'flexible', kind: 'flexible', limit: 20000, spent: 0 },
  ],
  contributionsThisMonth: 0,
  goals: [high, { ...high, id: 'b', priority: 'low', remaining: 10000 }],
};

it('DSS-006 funds priority and exposes shortfalls with only flexible reductions suggested', () => {
  expect(allocateGoals(input)).toMatchObject({
    ok: true,
    value: {
      capacity: 20000,
      deficit: 0,
      allocations: [
        { goalId: 'a', requested: 15000, allocated: 15000, gap: 0 },
        { goalId: 'b', requested: 10000, allocated: 5000, gap: 5000 },
      ],
      edits: [{ categoryId: 'flexible', amount: 15000 }],
    },
  });
});

it('DSS-003 reserves overspending and actual contributions; deficit prevents every allocation', () => {
  expect(
    allocateGoals({
      ...input,
      contributionsThisMonth: 3000,
      categories: [
        { id: 'essential', kind: 'essential', limit: 60000, spent: 80000 },
        { id: 'flexible', kind: 'flexible', limit: 20000, spent: 25000 },
      ],
    }),
  ).toMatchObject({
    ok: true,
    value: {
      capacity: 0,
      deficit: 8000,
      allocations: [{ allocated: 0 }, { allocated: 0 }],
      edits: [],
    },
  });
  expect(allocateGoals({ ...input, contributionsThisMonth: 5000 })).toMatchObject({
    ok: true,
    value: { capacity: 15000, allocations: [{ allocated: 15000 }, { allocated: 0 }] },
  });
});

it('DSS-004 uses inclusive months and exact ceiling division with deterministic deadline and ID ties', () => {
  const goal: PlanningGoal = { ...high, remaining: 101, deadline: '2026-12-01' };
  expect(
    allocateGoals({
      ...input,
      goals: [
        { ...goal, id: 'b' },
        { ...goal, id: 'a' },
        { ...goal, id: 'earlier', deadline: '2026-11-30' },
      ],
    }),
  ).toMatchObject({
    ok: true,
    value: {
      allocations: [
        { goalId: 'earlier', requested: 51 },
        { goalId: 'a', requested: 34 },
        { goalId: 'b', requested: 34 },
      ],
    },
  });
  const result = allocateGoals({
    ...input,
    plannedIncome: Number.MAX_SAFE_INTEGER,
    categories: [],
    goals: [{ ...goal, remaining: Number.MAX_SAFE_INTEGER }],
  });
  expect(result).toMatchObject({
    ok: true,
    value: { allocations: [{ requested: 3002399751580331 }] },
  });
});

it('DSS-005 keeps overdue and unconfigured undated goals separate; completed goals do not consume funds', () => {
  const result = allocateGoals({
    ...input,
    goals: [
      { ...high, id: 'overdue', deadline: '2026-09-30' },
      { ...high, id: 'undated', deadline: null },
      { ...high, id: 'desired', deadline: null, desiredMonthly: 20000 },
      { ...high, id: 'done', state: 'completed' },
      { ...high, id: 'archived', state: 'archived' },
      { ...high, id: 'funded', remaining: 0 },
    ],
  });
  expect(result).toMatchObject({
    ok: true,
    value: {
      allocations: [
        { goalId: 'overdue', allocated: 0, gap: 15000 },
        { goalId: 'desired', requested: 15000, allocated: 15000 },
        { goalId: 'undated', requested: 0, allocated: 0 },
      ],
    },
  });
});

it('MONEY-001 rejects invalid months, unsafe reserve sums, duplicates and invalid goal metadata', () => {
  expect(allocateGoals({ ...input, month: '2026-13' })).toMatchObject({ ok: false });
  expect(
    allocateGoals({ ...input, contributionsThisMonth: Number.MAX_SAFE_INTEGER }),
  ).toMatchObject({ ok: false });
  expect(allocateGoals({ ...input, goals: [high, high] })).toMatchObject({ ok: false });
  expect(allocateGoals({ ...input, goals: [{ ...high, remaining: -1 }] })).toMatchObject({
    ok: false,
  });
});
