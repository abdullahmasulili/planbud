import { createHostDatabase } from './host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createBudgetRepository } from '@/domains/budgeting/infrastructure/budget-repository';
import { createBudgetService } from '@/domains/budgeting/application/budget-service';
import { createTransactionRepository } from '@/domains/transactions/infrastructure/transaction-repository';
import { createTransactionService } from '@/domains/transactions/application/transaction-service';
import { createGoalRepository } from '@/domains/goals/infrastructure/goal-repository';
import { createGoalService } from '@/domains/goals/application/goal-service';
import { createPlanningAdapter } from '@/composition/planning-adapter';
import { createPlanningService } from '@/domains/budgeting/application/planning-service';

/** Composes isolated actual SQLite ports for cross-layer financial interaction tests.
 * @returns Confirmed USD profile, category, services, and lifecycle-owned database.
 */
export const createTransactionFixture = async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    const profile = await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const budgets = createBudgetService(createBudgetRepository(database));
    await budgets.saveCategory({ id: 'food', name: 'Food', kind: 'essential', archived: false });
    return {
      database,
      profile,
      budgets,
      transactions: createTransactionService(createTransactionRepository(database)),
      goals: createGoalService(createGoalRepository(database), () => '2026-10-20'),
      planning: createPlanningService(createPlanningAdapter(database)),
    };
  } catch (error) {
    try {
      await database.close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], 'Fixture setup and cleanup failed.');
    }
    throw error;
  }
};
