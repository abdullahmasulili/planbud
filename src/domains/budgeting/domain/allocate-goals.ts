import type { Result } from '@/shared/domain/result';
import { addAmounts } from '@/shared/domain/money';
import { parseDate, monthsInclusive } from '@/shared/domain/calendar-date';
import { isAmount, isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';

/** Consumer-owned goal inputs; actual progress is mapped through public application contracts. */
export type PlanningGoal = {
  readonly id: string;
  readonly state: 'active' | 'completed' | 'archived';
  readonly remaining: number;
  readonly deadline: string | null;
  readonly priority: 'high' | 'medium' | 'low';
  readonly desiredMonthly: number | null;
};
/** One consistent financial snapshot in exact currency minor units. */
export type PlanningInput = {
  readonly month: string;
  readonly revision: number;
  readonly plannedIncome: number;
  readonly categories: readonly {
    readonly id: string;
    readonly kind: 'essential' | 'flexible';
    readonly limit: number;
    readonly spent: number;
  }[];
  readonly contributionsThisMonth: number;
  readonly goals: readonly PlanningGoal[];
};
/** Explicit flexible-limit adjustment; essential reserves are never automatically reduced. */
export type CategoryLimitEdit = { readonly categoryId: string; readonly amount: number };
/** Explainable estimate tied to a global source revision, never an actual contribution. */
export type PlanningPreview = {
  readonly month: string;
  readonly revision: number;
  readonly capacity: number;
  readonly deficit: number;
  readonly allocations: readonly {
    readonly goalId: string;
    readonly requested: number;
    readonly allocated: number;
    readonly gap: number;
    readonly reasons: readonly string[];
  }[];
  readonly edits: readonly CategoryLimitEdit[];
};

const ranks = { high: 0, medium: 1, low: 2 };

/** Orders plain identifiers deterministically without device locale collation.
 * @param left First string.
 * @param right Second string.
 * @returns Stable lexical ordering.
 */
const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** Allocates only available capacity by priority, inclusive deadline horizon, then stable ID.
 * @param input Same-revision estimates and actual reserve inputs, all in minor units.
 * @returns Nonnegative allocations, separate deficit/overdue labels, and optional flexible cuts.
 */
export const allocateGoals = (input: PlanningInput): Result<PlanningPreview> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-planning-input',
      message: 'Review the plan amounts, goal settings, and calendar month.',
    },
  };
  if (
    !/^\d{4}-\d{2}$/.test(input.month) ||
    !parseDate(input.month + '-01').ok ||
    !isAmount(input.revision) ||
    !isAmount(input.plannedIncome) ||
    !isAmount(input.contributionsThisMonth) ||
    new Set(input.categories.map((item) => item.id)).size !== input.categories.length ||
    new Set(input.goals.map((item) => item.id)).size !== input.goals.length
  )
    return invalid;
  if (
    input.categories.some(
      (item) =>
        !isText(item.id, MAX_ID_LENGTH) ||
        (item.kind !== 'essential' && item.kind !== 'flexible') ||
        !isAmount(item.limit) ||
        !isAmount(item.spent),
    )
  )
    return invalid;
  if (
    input.goals.some(
      (goal) =>
        !isText(goal.id, MAX_ID_LENGTH) ||
        !isAmount(goal.remaining) ||
        (goal.state !== 'active' && goal.state !== 'completed' && goal.state !== 'archived') ||
        (goal.priority !== 'high' && goal.priority !== 'medium' && goal.priority !== 'low') ||
        (goal.deadline !== null && !parseDate(goal.deadline).ok) ||
        (goal.desiredMonthly !== null &&
          (!isAmount(goal.desiredMonthly) || goal.desiredMonthly === 0)),
    )
  )
    return invalid;
  const reserved = addAmounts([
    ...input.categories.map((item) => Math.max(item.limit, item.spent)),
    input.contributionsThisMonth,
  ]);
  if (!reserved.ok) return reserved;
  const balance = input.plannedIncome - reserved.value;
  const capacity = Math.max(0, balance);
  const deficit = Math.max(0, -balance);
  let available = capacity;
  const goals = input.goals
    .filter((goal) => goal.state === 'active' && goal.remaining > 0)
    .sort(
      (a, b) =>
        ranks[a.priority] - ranks[b.priority] ||
        compareText(a.deadline ?? '9999-99-99', b.deadline ?? '9999-99-99') ||
        compareText(a.id, b.id),
    );
  const allocations: PlanningPreview['allocations'][number][] = [];
  const eligibleGaps: number[] = [];
  for (const goal of goals) {
    const overdue = goal.deadline !== null && goal.deadline.slice(0, 7) < input.month;
    let requested = 0;
    let reason = '';
    if (overdue) {
      requested = goal.remaining;
      reason =
        'Overdue before this planning month; review the deadline or target. No automatic allocation.';
    } else if (goal.deadline) {
      const months = monthsInclusive(input.month, goal.deadline.slice(0, 7));
      if (!months.ok) return months;
      requested = Number(
        (BigInt(goal.remaining) + BigInt(months.value) - 1n) / BigInt(months.value),
      );
      reason = `Remaining ${goal.remaining} minor units ÷ ${months.value} inclusive months, rounded up.`;
    } else if (goal.desiredMonthly !== null) {
      requested = Math.min(goal.remaining, goal.desiredMonthly);
      reason = `User-selected monthly amount ${goal.desiredMonthly} minor units, capped at remaining ${goal.remaining}.`;
    } else
      reason = 'No deadline or desired monthly amount; set either in Goals to enable allocation.';
    const allocated = overdue ? 0 : Math.min(requested, available, goal.remaining);
    available -= allocated;
    if (!overdue) eligibleGaps.push(requested - allocated);
    allocations.push({
      goalId: goal.id,
      requested,
      allocated,
      gap: requested - allocated,
      reasons: [
        reason,
        `${goal.priority} priority; available capacity is reserved in priority, deadline, then ID order.`,
        `Income ${input.plannedIncome} − category reserves ${reserved.value - input.contributionsThisMonth} − actual monthly contributions ${input.contributionsThisMonth}, all in minor units.`,
      ],
    });
  }
  const gaps = addAmounts(eligibleGaps);
  if (!gaps.ok) return gaps;
  const need = addAmounts([deficit, gaps.value]);
  if (!need.ok) return need;
  let reduction = need.value;
  const edits: CategoryLimitEdit[] = [];
  for (const category of [...input.categories].sort((a, b) => compareText(a.id, b.id))) {
    if (category.kind !== 'flexible') continue;
    const cut = Math.min(reduction, Math.max(0, category.limit - category.spent));
    if (cut > 0) edits.push({ categoryId: category.id, amount: category.limit - cut });
    reduction -= cut;
  }
  return {
    ok: true,
    value: { month: input.month, revision: input.revision, capacity, deficit, allocations, edits },
  };
};
