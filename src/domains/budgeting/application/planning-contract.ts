import type { PlanningInput, PlanningPreview, CategoryLimitEdit } from '../domain/allocate-goals';
import type { Result } from '@/shared/domain/result';
export type { PlanningInput, PlanningPreview, CategoryLimitEdit } from '../domain/allocate-goals';

/** Atomic read/recalculation boundary supplied by composition across source repositories. */
export type PlanningPorts = {
  readonly readInput: (month: string) => Promise<PlanningInput>;
  readonly commit: (input: {
    readonly expectedRevision: number;
    readonly month: string;
    readonly edits: readonly CategoryLimitEdit[];
    readonly allocations: readonly { readonly goalId: string; readonly amount: number }[];
  }) => Promise<void>;
};
/** Explicit estimates and apply actions; optional edits are previewed before commitment. */
export type PlanningService = {
  readonly preview: (
    month: string,
    edits?: readonly CategoryLimitEdit[],
  ) => Promise<Result<PlanningPreview>>;
  readonly apply: (input: {
    readonly preview: PlanningPreview;
    readonly selectedEdits: readonly CategoryLimitEdit[];
  }) => Promise<Result<void>>;
};
