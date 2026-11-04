import { parseNamedPlan, summarizeNamedPlan } from './named-plan';

const vacation = {
  id: 'vacation',
  name: 'Vacation',
  funding: 100000,
  items: [{ id: 'hotel', name: 'Hotel', amount: 60000 }],
};
it('PLAN-002 derives independent allocation and preserves an overallocated shortfall', () => {
  expect(parseNamedPlan(vacation)).toEqual({ ok: true, value: vacation });
  expect(summarizeNamedPlan(vacation)).toEqual({ allocated: 60000, remaining: 40000 });
  expect(summarizeNamedPlan({ ...vacation, funding: 50000 })).toEqual({
    allocated: 60000,
    remaining: -10000,
  });
  expect(parseNamedPlan({ ...vacation, funding: 0, items: [] }).ok).toBe(true);
});
it.each([
  { ...vacation, name: ' ' },
  { ...vacation, funding: -1 },
  { ...vacation, funding: 1.2 },
  { ...vacation, items: [...vacation.items, ...vacation.items] },
  { ...vacation, items: [{ id: 'x', name: ' ', amount: 1 }] },
  {
    ...vacation,
    items: [
      { id: 'a', name: 'A', amount: Number.MAX_SAFE_INTEGER },
      { id: 'b', name: 'B', amount: 1 },
    ],
  },
  {
    ...vacation,
    items: Array.from({ length: 101 }, (_, i) => ({ id: String(i), name: 'Item', amount: 1 })),
  },
])('PLAN-002 rejects invalid, duplicate, excessive, and overflowing estimates', (input) => {
  expect(parseNamedPlan(input).ok).toBe(false);
});
