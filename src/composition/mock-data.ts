import type { Transaction } from '@/domains/transactions/application/public';
import type { Result } from '@/shared/domain/result';
import { openDatabase } from '@/shared/infrastructure/database/connection';
import { calendarToday } from '@/shared/presentation/calendar-today';
import { bootstrap } from './bootstrap';
import type { Runtime } from './bootstrap';

/** Stops preview setup when a use case rejects a sample record.
 * @param result Outcome from the same use cases that handle app edits.
 * @returns The validated value.
 * @throws When the sample record could not be saved or read.
 */
const requireValue = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

/** Starts a disposable database with example records for the current calendar month.
 * @param open Connection owner; tests substitute host SQLite for the native in-memory connection.
 * @param today Local calendar date used to keep examples in the default month.
 * @returns The seeded app runtime or a startup failure.
 * Rejects after closing the database if seeding fails.
 */
export const bootstrapMockData = async (
  open: Parameters<typeof bootstrap>[0] = async () => await openDatabase(':memory:'),
  today = calendarToday(),
): Promise<Result<Runtime>> => {
  const result = await bootstrap(open);
  if (!result.ok) return result;

  const { database, services } = result.value;
  const { profiles, budgets, transactions, goals, namedPlans } = services;
  const month = today.slice(0, 7);
  try {
    const profile = requireValue(
      await profiles.confirm({
        id: 'mock-profile',
        currency: { code: 'USD', exponent: 2 },
        locale: 'en-US',
        appearance: 'system',
      }),
    );
    requireValue(
      await budgets.saveCategory({ id: 'rent', name: 'Rent', kind: 'essential', archived: false }),
    );
    requireValue(
      await budgets.saveCategory({
        id: 'groceries',
        name: 'Groceries',
        kind: 'essential',
        archived: false,
      }),
    );
    requireValue(
      await budgets.saveCategory({
        id: 'dining',
        name: 'Dining out',
        kind: 'flexible',
        archived: false,
      }),
    );
    requireValue(
      await budgets.savePlan({
        expectedRevision: await database.revision(),
        plan: {
          month,
          plannedIncome: 420_000,
          limits: [
            { categoryId: 'rent', amount: 135_000 },
            { categoryId: 'groceries', amount: 40_000 },
            { categoryId: 'dining', amount: 12_000 },
          ],
        },
      }),
    );

    const entries: Transaction[] = [
      {
        id: 'pay',
        type: 'income',
        categoryId: null,
        amount: 420_000,
        date: `${month}-01`,
        note: 'Paycheck',
      },
      {
        id: 'rent-payment',
        type: 'expense',
        categoryId: 'rent',
        amount: 135_000,
        date: `${month}-01`,
        note: 'Monthly rent',
      },
      {
        id: 'market',
        type: 'expense',
        categoryId: 'groceries',
        amount: 8_450,
        date: today,
        note: 'Weekly groceries',
      },
      {
        id: 'dinner',
        type: 'expense',
        categoryId: 'dining',
        amount: 3_280,
        date: today,
        note: 'Dinner with friends',
      },
    ];
    for (const entry of entries) {
      requireValue(await transactions.save({ operationId: `mock-${entry.id}`, input: entry }));
    }

    requireValue(
      await goals.saveGoal({
        operationId: 'mock-goal',
        input: {
          id: 'emergency-fund',
          name: 'Emergency fund',
          target: 300_000,
          startingSaved: 75_000,
          deadline: null,
          priority: 'high',
          desiredMonthly: 25_000,
          state: 'active',
        },
      }),
    );
    requireValue(
      await goals.saveContribution({
        operationId: 'mock-contribution',
        input: { id: 'fund-deposit', goalId: 'emergency-fund', amount: 25_000, date: today },
      }),
    );
    requireValue(
      await namedPlans.save({
        expectedRevision: await database.revision(),
        plan: {
          id: 'weekend-trip',
          name: 'Weekend trip',
          funding: 60_000,
          items: [
            { id: 'train', name: 'Train tickets', amount: 12_000 },
            { id: 'hotel', name: 'Two nights', amount: 30_000 },
          ],
        },
      }),
    );
    return { ok: true, value: { ...result.value, profile } };
  } catch (error) {
    try {
      await result.value.close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], 'Mock data setup and cleanup failed.');
    }
    throw error;
  }
};
