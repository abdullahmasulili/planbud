import type { Category } from './category';
import type { MonthlyPlan } from './monthly-plan';
import { parseMonthlyPlan } from './monthly-plan';
import { addAmounts } from '@/shared/domain/money';
import { isAmount } from '@/shared/domain/validation';
import type { Result } from '@/shared/domain/result';

/** Budget-owned actual-activity input mapped from published transaction contracts. */
export type OverviewActuals = {
  readonly income: number;
  readonly spending: number;
  readonly byCategory: readonly { readonly categoryId: string; readonly amount: number }[];
};
/** Derived estimate-versus-actual view; no totals are written back as source records. */
export type BudgetOverview = {
  readonly month: string;
  readonly plannedIncome: number;
  readonly actualIncome: number;
  readonly plannedSpending: number;
  readonly actualSpending: number;
  readonly remainingSpending: number;
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
    readonly limit: number;
    readonly spent: number;
    readonly remaining: number;
  }[];
};

/** Compares independent estimates and actual spending with safe arithmetic.
 * @param plan Validated source estimates for one month.
 * @param categories Active and archived metadata retaining historical labels.
 * @param actuals Source-derived activity for the same month.
 * @returns A consistent overview or rejected unsafe/inconsistent inputs.
 */
export const buildOverview = (
  plan: MonthlyPlan,
  categories: readonly Category[],
  actuals: OverviewActuals,
): Result<BudgetOverview> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-overview',
      message: 'Unable to calculate these totals. Reload the month and review the amounts.',
    },
  };
  if (!parseMonthlyPlan(plan).ok || !isAmount(actuals.income) || !isAmount(actuals.spending))
    return invalid;
  const planned = addAmounts(plan.limits.map((limit) => limit.amount));
  const spending = addAmounts(actuals.byCategory.map((entry) => entry.amount));
  if (
    !planned.ok ||
    !spending.ok ||
    spending.value !== actuals.spending ||
    new Set(actuals.byCategory.map((entry) => entry.categoryId)).size !== actuals.byCategory.length
  )
    return invalid;
  const limits = new Map(plan.limits.map((entry) => [entry.categoryId, entry.amount]));
  const actual = new Map(actuals.byCategory.map((entry) => [entry.categoryId, entry.amount]));
  const labels = new Map(categories.map((category) => [category.id, category.name]));
  const rows: { id: string; name: string; limit: number; spent: number; remaining: number }[] = [];
  for (const id of new Set([...limits.keys(), ...actual.keys()])) {
    const name = labels.get(id);
    if (name === undefined) return invalid;
    const limit = limits.get(id) ?? 0;
    const spent = actual.get(id) ?? 0;
    rows.push({ id, name, limit, spent, remaining: limit - spent });
  }
  return {
    ok: true,
    value: {
      month: plan.month,
      plannedIncome: plan.plannedIncome,
      actualIncome: actuals.income,
      plannedSpending: planned.value,
      actualSpending: actuals.spending,
      remainingSpending: planned.value - actuals.spending,
      categories: rows,
    },
  };
};
