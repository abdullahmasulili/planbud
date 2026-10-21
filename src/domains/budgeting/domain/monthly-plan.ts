import { isAmount, isRecord, isText } from '@/shared/domain/validation';
import { parseDate } from '@/shared/domain/calendar-date';
import type { MonthKey } from '@/shared/domain/calendar-date';
import type { MinorAmount } from '@/shared/domain/money';
import { addAmounts } from '@/shared/domain/money';
import type { Result } from '@/shared/domain/result';
import { MAX_ID_LENGTH, MAX_SNAPSHOT_RECORDS } from '@/shared/domain/record-limits';

/** Independent calendar-month estimate with one limit per category, in minor units. */
export type MonthlyPlan = {
  readonly month: MonthKey;
  readonly plannedIncome: MinorAmount;
  readonly limits: readonly { readonly categoryId: string; readonly amount: MinorAmount }[];
};
/** Committed plan and database revision used for optimistic concurrency checks. */
export type PlanVersion = { readonly plan: MonthlyPlan; readonly revision: number };

/** Planned monthly earmarking; it never increases actual goal savings. */
export type GoalAllocation = {
  readonly month: MonthKey;
  readonly goalId: string;
  readonly amount: MinorAmount;
};

/** Validates a portable allocation without consulting mutable source records.
 * @param input Untrusted snapshot or repository record.
 * @returns Canonical planned amount or a validation failure; relationships are checked by the snapshot owner.
 */
export const parseGoalAllocation = (input: unknown): Result<GoalAllocation> => {
  if (
    !isRecord(input) ||
    typeof input.month !== 'string' ||
    !/^\d{4}-\d{2}$/.test(input.month) ||
    !parseDate(input.month + '-01').ok ||
    !isText(input.goalId, MAX_ID_LENGTH) ||
    !isAmount(input.amount)
  )
    return {
      ok: false,
      error: {
        code: 'invalid-allocation',
        message: 'Choose a valid month, goal and planned amount.',
      },
    };
  return { ok: true, value: { month: input.month, goalId: input.goalId, amount: input.amount } };
};

/** Validates bounded monthly estimates while preserving legal zero values.
 * @param input Untrusted monthly plan.
 * @returns Validated plan or a sanitized input failure.
 */
export const parseMonthlyPlan = (input: unknown): Result<MonthlyPlan> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-plan',
      message: 'Use a valid month and nonnegative amounts, with one limit per category.',
    },
  };
  if (
    !isRecord(input) ||
    typeof input.month !== 'string' ||
    !/^\d{4}-\d{2}$/.test(input.month) ||
    !parseDate(input.month + '-01').ok ||
    !isAmount(input.plannedIncome) ||
    !Array.isArray(input.limits) ||
    input.limits.length > MAX_SNAPSHOT_RECORDS
  )
    return invalid;
  const limits: { categoryId: string; amount: number }[] = [];
  const seen = new Set<string>();
  const candidates: readonly unknown[] = input.limits;
  for (const item of candidates) {
    if (
      !isRecord(item) ||
      !isText(item.categoryId, MAX_ID_LENGTH) ||
      !isAmount(item.amount) ||
      seen.has(item.categoryId)
    )
      return invalid;
    seen.add(item.categoryId);
    limits.push({ categoryId: item.categoryId, amount: item.amount });
  }
  if (!addAmounts(limits.map((limit) => limit.amount)).ok)
    return {
      ok: false,
      error: {
        code: 'amount-overflow',
        message: 'Combined category limits exceed the supported range. Reduce the limits.',
      },
    };
  return { ok: true, value: { month: input.month, plannedIncome: input.plannedIncome, limits } };
};
