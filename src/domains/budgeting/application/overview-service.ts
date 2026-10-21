import type { BudgetService } from './public';
import type { TransactionService } from '@/domains/transactions/application/public';
import type { Result } from '@/shared/domain/result';
import { buildOverview } from '../domain/overview';
import type { BudgetOverview } from '../domain/overview';
export type { BudgetOverview } from '../domain/overview';

/** Reads source contracts and derives a comparison without exposing domain policies to views.
 * @param month Selected calendar month.
 * @param budgets Narrow published estimate/category reads.
 * @param transactions Narrow published actual-activity read.
 * @returns Validated comparison or the owning read/calculation failure.
 */
export const readOverview = async (
  month: string,
  budgets: Pick<BudgetService, 'readMonth' | 'readCategories'>,
  transactions: Pick<TransactionService, 'summary'>,
): Promise<Result<BudgetOverview>> => {
  const [plan, categories, actuals] = await Promise.all([
    budgets.readMonth(month),
    budgets.readCategories(),
    transactions.summary(month),
  ]);
  if (!plan.ok) return plan;
  if (!categories.ok) return categories;
  if (!actuals.ok) return actuals;
  return buildOverview(plan.value.plan, categories.value, actuals.value);
};
