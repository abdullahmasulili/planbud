import type { Profile } from '@/domains/settings/application/public';
import type { Category, MonthlyPlan, GoalAllocation } from '@/domains/budgeting/application/public';
import type { Transaction } from '@/domains/transactions/application/public';
import type { Goal, Contribution } from '@/domains/goals/application/public';

/** Portable source records only; recovery bindings, commands, totals and provider paths are excluded. */
export type SnapshotV1 = {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly profile: Profile;
  readonly categories: readonly Category[];
  readonly plans: readonly MonthlyPlan[];
  readonly transactions: readonly Transaction[];
  readonly goals: readonly Goal[];
  readonly contributions: readonly Contribution[];
  readonly allocations: readonly GoalAllocation[];
};
/** One consistent durable snapshot and the source revision it represents. */
export type SnapshotPort = {
  readonly readConsistent: () => Promise<{
    readonly snapshot: SnapshotV1;
    readonly revision: number;
  }>;
};
