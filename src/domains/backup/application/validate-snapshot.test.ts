import { validateSnapshot } from './validate-snapshot';
import type { SnapshotV1 } from './snapshot';
import { MAX_SNAPSHOT_RECORDS } from '@/shared/domain/record-limits';

const snapshot: SnapshotV1 = {
  schemaVersion: 1,
  createdAt: '2026-10-20T00:00:00.000Z',
  profile: { id: 'p', currency: { code: 'USD', exponent: 2 }, locale: 'en-US', appearance: 'dark' },
  categories: [{ id: 'food', name: 'Food', kind: 'essential', archived: false }],
  plans: [
    { month: '2026-10', plannedIncome: 10000, limits: [{ categoryId: 'food', amount: 5000 }] },
  ],
  transactions: [
    { id: 't', type: 'expense', categoryId: 'food', amount: 100, date: '2026-10-20', note: '' },
  ],
  goals: [
    {
      id: 'g',
      name: 'Fund',
      target: 10000,
      startingSaved: 100,
      deadline: null,
      priority: 'high',
      desiredMonthly: 1000,
      state: 'active',
    },
  ],
  contributions: [{ id: 'c', goalId: 'g', amount: 100, date: '2026-10-20' }],
  allocations: [{ month: '2026-10', goalId: 'g', amount: 1000 }],
};

it('BACK-001 validates every portable source field and refuses all hidden metadata or unexpected fields', () => {
  expect(validateSnapshot(snapshot)).toEqual({ ok: true, value: snapshot });
  for (const value of [
    { ...snapshot, entropy: 'forbidden' },
    { ...snapshot, profile: { ...snapshot.profile, credentials: {} } },
    {
      ...snapshot,
      plans: [
        { ...snapshot.plans[0], limits: [{ categoryId: 'food', amount: 5, path: 'forbidden' }] },
      ],
    },
    { ...snapshot, goals: [{ ...snapshot.goals[0], saved: 200 }] },
  ])
    expect(validateSnapshot(value)).toMatchObject({ ok: false });
});

it('RESTORE-002 rejects malformed relationships, duplicate IDs and canonical money/date/currency failures', () => {
  for (const value of [
    { ...snapshot, schemaVersion: 2 },
    { ...snapshot, createdAt: 'yesterday' },
    { ...snapshot, categories: [] },
    { ...snapshot, transactions: [...snapshot.transactions, ...snapshot.transactions] },
    { ...snapshot, contributions: [{ ...snapshot.contributions[0], goalId: 'missing' }] },
    { ...snapshot, allocations: [{ month: '2026-11', goalId: 'g', amount: 1 }] },
    { ...snapshot, profile: { ...snapshot.profile, currency: { code: 'USD', exponent: 0 } } },
    { ...snapshot, transactions: [{ ...snapshot.transactions[0], date: '2026-02-30' }] },
    { ...snapshot, goals: [{ ...snapshot.goals[0], startingSaved: Number.MAX_SAFE_INTEGER }] },
    { ...snapshot, goals: [{ ...snapshot.goals[0], name: 'x'.repeat(121) }] },
  ])
    expect(validateSnapshot(value)).toMatchObject({ ok: false });
});

it('RESTORE-002 bounds total nested records and counts Unicode names by code point', () => {
  expect(
    validateSnapshot({
      ...snapshot,
      categories: Array.from({ length: MAX_SNAPSHOT_RECORDS }, (_, index) => ({
        id: `category-${index}`,
        name: 'Food',
        kind: 'essential',
        archived: false,
      })),
    }),
  ).toMatchObject({ ok: false });
  expect(
    validateSnapshot({ ...snapshot, goals: [{ ...snapshot.goals[0], name: '💰'.repeat(120) }] }),
  ).toMatchObject({ ok: true });
});
