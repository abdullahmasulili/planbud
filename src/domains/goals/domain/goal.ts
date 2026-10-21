import type { CalendarDate } from '@/shared/domain/calendar-date';
import { parseDate } from '@/shared/domain/calendar-date';
import { addAmounts } from '@/shared/domain/money';
import type { Result } from '@/shared/domain/result';
import { MAX_ID_LENGTH, MAX_NAME_LENGTH } from '@/shared/domain/record-limits';
import { isAmount, isRecord, isText } from '@/shared/domain/validation';
import type { Contribution } from './contribution';
import { parseContribution } from './contribution';

/** User-defined target; completion changes eligibility without inventing actual savings. */
export type Goal = {
  readonly id: string;
  readonly name: string;
  readonly target: number;
  readonly startingSaved: number;
  readonly deadline: CalendarDate | null;
  readonly priority: 'high' | 'medium' | 'low';
  readonly desiredMonthly: number | null;
  readonly state: 'active' | 'completed' | 'archived';
};
/** Source goal and history with recomputed, nonpersisted progress. */
export type GoalProgress = Goal & {
  readonly contributions: readonly Contribution[];
  readonly saved: number;
  readonly remaining: number;
  readonly overdue: boolean;
};

/** Validates goal metadata without forcing undated goals to participate in automatic planning.
 * @param input Untrusted form, repository row, or imported record.
 * @returns Canonical goal or a bounded field validation failure.
 */
export const parseGoal = (input: unknown): Result<Goal> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-goal',
      message: 'Enter a name, positive target, valid savings and optional date or monthly amount.',
    },
  };
  if (
    !isRecord(input) ||
    !isText(input.id, MAX_ID_LENGTH) ||
    !isText(input.name, MAX_NAME_LENGTH) ||
    !isAmount(input.target) ||
    input.target === 0 ||
    !isAmount(input.startingSaved) ||
    (input.priority !== 'high' && input.priority !== 'medium' && input.priority !== 'low') ||
    (input.state !== 'active' && input.state !== 'completed' && input.state !== 'archived')
  )
    return invalid;
  const deadline = input.deadline;
  const desiredMonthly = input.desiredMonthly;
  if (deadline !== null && (typeof deadline !== 'string' || !parseDate(deadline).ok))
    return invalid;
  if (desiredMonthly !== null && (!isAmount(desiredMonthly) || desiredMonthly === 0))
    return invalid;
  return {
    ok: true,
    value: {
      id: input.id,
      name: input.name.trim(),
      target: input.target,
      startingSaved: input.startingSaved,
      deadline,
      priority: input.priority,
      desiredMonthly,
      state: input.state,
    },
  };
};

/** Derives actual savings with overflow and ownership checks; planned money never enters this sum.
 * @param goal Validated source goal.
 * @param contributions Actual history for this goal only.
 * @param today Injected calendar date for attention labels.
 * @returns Derived progress; rejects duplicate IDs, mismatched history, and unsafe totals.
 */
export const goalProgress = (
  goal: Goal,
  contributions: readonly Contribution[],
  today: CalendarDate,
): Result<GoalProgress> => {
  const parsed = parseGoal(goal);
  if (!parsed.ok) return parsed;
  if (
    !parseDate(today).ok ||
    new Set(contributions.map((item) => item.id)).size !== contributions.length ||
    contributions.some((item) => !parseContribution(item).ok || item.goalId !== goal.id)
  )
    return {
      ok: false,
      error: { code: 'invalid-history', message: 'Unable to read this goal history.' },
    };
  const total = addAmounts([goal.startingSaved, ...contributions.map((item) => item.amount)]);
  if (!total.ok)
    return {
      ok: false,
      error: {
        code: 'amount-overflow',
        message: 'Goal savings exceed the supported amount range.',
      },
    };
  const remaining = Math.max(0, goal.target - total.value);
  return {
    ok: true,
    value: {
      ...parsed.value,
      contributions,
      saved: total.value,
      remaining,
      overdue:
        goal.state === 'active' && remaining > 0 && goal.deadline !== null && goal.deadline < today,
    },
  };
};
