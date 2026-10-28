import type { Profile } from '@/domains/settings/application/public';
import type {
  Category,
  MonthlyPlan,
  GoalAllocation,
  NamedPlan,
} from '@/domains/budgeting/application/public';
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
/** Version-2 payload adds independent estimates; cryptographic container version stays 1. */
export type SnapshotV2 = Omit<SnapshotV1, 'schemaVersion'> & {
  readonly schemaVersion: 2;
  readonly namedPlans: readonly NamedPlan[];
};
/** Supported portable payload versions; original backups retain strict version-1 validation. */
export type Snapshot = SnapshotV1 | SnapshotV2;
/** One consistent durable snapshot and the source revision it represents. */
export type SnapshotPort = {
  readonly readConsistent: () => Promise<{
    readonly snapshot: Snapshot;
    readonly revision: number;
  }>;
};
