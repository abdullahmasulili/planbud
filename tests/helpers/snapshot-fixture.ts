import type { SnapshotV1 } from '@/domains/backup/application/snapshot';

/** Supplies complete synthetic portable data with a different profile/currency for restore contracts.
 * @returns Fixed nonpersonal source data; contains no recovery secret or provider location.
 */
export const snapshotFixture = (): SnapshotV1 => ({
  schemaVersion: 1,
  createdAt: '2026-10-20T00:00:00.000Z',
  profile: {
    id: 'restored-profile',
    currency: { code: 'JPY', exponent: 0 },
    locale: 'ja-JP',
    appearance: 'dark',
  },
  categories: [{ id: 'restored-food', name: 'Food', kind: 'essential', archived: true }],
  plans: [
    { month: '2026-09', plannedIncome: 50000, limits: [] },
    {
      month: '2026-10',
      plannedIncome: 100000,
      limits: [{ categoryId: 'restored-food', amount: 60000 }],
    },
  ],
  transactions: [
    {
      id: 'expense',
      type: 'expense',
      amount: 1000,
      categoryId: 'restored-food',
      date: '2026-10-20',
      note: 'Synthetic history',
    },
    {
      id: 'income',
      type: 'income',
      amount: 100000,
      categoryId: null,
      date: '2026-10-01',
      note: '',
    },
  ],
  goals: [
    {
      id: 'restored-goal',
      name: 'Emergency',
      target: 30000,
      startingSaved: 1000,
      deadline: '2026-12-31',
      priority: 'high',
      desiredMonthly: null,
      state: 'active',
    },
  ],
  contributions: [
    { id: 'restored-contribution', goalId: 'restored-goal', amount: 2000, date: '2026-10-20' },
  ],
  allocations: [{ month: '2026-10', goalId: 'restored-goal', amount: 9000 }],
});

/** Supplies exactly 50,000 synthetic records, including nested limits, for disposable stress tests.
 * @param mode Transaction-heavy data or the maximum balanced goal/history relationship workload.
 * @returns Nonpersonal JPY data at the shared snapshot limit.
 */
export const stressSnapshot = (mode: 'transactions' | 'goals' = 'transactions'): SnapshotV1 => {
  const source = snapshotFixture();
  const plan = source.plans[1];
  const goal = source.goals[0];
  if (!plan || !goal) throw new Error('Incomplete synthetic fixture.');
  const goalCount = mode === 'goals' ? 24998 : 500;
  const transactionCount = mode === 'goals' ? 0 : 48996;
  return {
    ...source,
    categories: source.categories.map((category) => ({ ...category, archived: false })),
    plans: [plan],
    transactions: Array.from({ length: transactionCount }, (_, index) => ({
      id: `stress-transaction-${String(index).padStart(5, '0')}`,
      type: 'expense' as const,
      amount: 1,
      categoryId: 'restored-food',
      date: '2026-10-20',
      note: index === 0 ? 'Synthetic maximum-length note. '.padEnd(2000, 'x') : 'Synthetic stress',
    })),
    goals: Array.from({ length: goalCount }, (_, index) => ({
      ...goal,
      id: `stress-goal-${String(index).padStart(5, '0')}`,
      name: `Synthetic goal ${index}`,
    })),
    contributions: Array.from({ length: goalCount }, (_, index) => ({
      id: `stress-contribution-${String(index).padStart(5, '0')}`,
      goalId: `stress-goal-${String(index).padStart(5, '0')}`,
      amount: 1,
      date: '2026-10-20',
    })),
    allocations: [{ month: '2026-10', goalId: 'stress-goal-00000', amount: 9000 }],
  };
};
