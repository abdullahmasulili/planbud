import type { Transaction } from './transaction';
import { addAmounts } from '@/shared/domain/money';
import type { Result } from '@/shared/domain/result';

/** Derived actual activity only; no planned allocations or goal contributions are included. */
export type MonthlyActuals = {
  readonly income: number;
  readonly spending: number;
  readonly byCategory: readonly { readonly categoryId: string; readonly amount: number }[];
};

/** Derives exact totals with explicit overflow handling and stable category ordering.
 * @param records Validated transaction source records for the requested calendar month.
 * @returns Actual income and expenses, rejecting unsupported arithmetic results.
 */
export const summarizeTransactions = (records: readonly Transaction[]): Result<MonthlyActuals> => {
  const income = addAmounts(
    records.filter((record) => record.type === 'income').map((record) => record.amount),
  );
  if (!income.ok) return income;
  const expenses = records.filter((record) => record.type === 'expense');
  const spending = addAmounts(expenses.map((record) => record.amount));
  if (!spending.ok) return spending;
  const groups = new Map<string, number[]>();
  for (const record of expenses) {
    if (record.categoryId === null)
      return {
        ok: false,
        error: { code: 'invalid-transaction', message: 'An expense category is missing.' },
      };
    const values = groups.get(record.categoryId) ?? [];
    values.push(record.amount);
    groups.set(record.categoryId, values);
  }
  const byCategory: { categoryId: string; amount: number }[] = [];
  for (const [categoryId, amounts] of groups) {
    const total = addAmounts(amounts);
    if (!total.ok) return total;
    byCategory.push({ categoryId, amount: total.value });
  }
  byCategory.sort((a, b) =>
    a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0,
  );
  return { ok: true, value: { income: income.value, spending: spending.value, byCategory } };
};
