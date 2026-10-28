import { openDatabase } from '@/shared/infrastructure/database/connection';
import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createProfileService } from '@/domains/settings/application/profile-service';
import type { Profile, ProfileService } from '@/domains/settings/application/public';
import { createBudgetRepository } from '@/domains/budgeting/infrastructure/budget-repository';
import { createBudgetService } from '@/domains/budgeting/application/budget-service';
import type { BudgetService, NamedPlanService } from '@/domains/budgeting/application/public';
import { createTransactionRepository } from '@/domains/transactions/infrastructure/transaction-repository';
import { createTransactionService } from '@/domains/transactions/application/transaction-service';
import type { TransactionService } from '@/domains/transactions/application/public';
import type { Result } from '@/shared/domain/result';
import { createGoalRepository } from '@/domains/goals/infrastructure/goal-repository';
import { createGoalService } from '@/domains/goals/application/goal-service';
import type { GoalService } from '@/domains/goals/application/public';
import { createNamedPlanService } from '@/domains/budgeting/application/named-plan-service';
import { createNamedPlanRepository } from '@/domains/budgeting/infrastructure/named-plan-repository';
import { calendarToday } from '@/shared/presentation/calendar-today';
import { createPlanningAdapter } from './planning-adapter';
import { createPlanningService } from '@/domains/budgeting/application/planning-service';
import type { PlanningService } from '@/domains/budgeting/application/planning-contract';

/** Stable stateless use-case capabilities backed by one durable database lifecycle. */
export type RuntimeServices = {
  readonly profiles: ProfileService;
  readonly budgets: BudgetService;
  readonly namedPlans: NamedPlanService;
  readonly transactions: TransactionService;
  readonly goals: GoalService;
  readonly planning: PlanningService;
};

/** Lifecycle-owned initialized dependencies; no recovery secrets enter this object. */
export type Runtime = {
  readonly database: DatabaseHandle;
  readonly profile: Profile | null;
  readonly recoveryReady: boolean;
  readonly services: RuntimeServices;
  readonly close: () => Promise<void>;
};

/** Opens and migrates durable data without resetting unsupported or damaged databases.
 * @param open Injectable connection owner for lifecycle and native contracts.
 * @returns Initialized runtime or actionable sanitized startup failure.
 */
export const bootstrap = async (
  open: () => Promise<DatabaseHandle> = openDatabase,
): Promise<Result<Runtime>> => {
  let database: DatabaseHandle | undefined;
  try {
    database = await open();
    await migrateDatabase(database);
    const repository = createProfileRepository(database);
    const profile = await repository.read();
    return {
      ok: true,
      value: {
        database,
        profile,
        recoveryReady: false,
        services: {
          profiles: createProfileService(repository),
          namedPlans: createNamedPlanService(createNamedPlanRepository(database)),
          budgets: createBudgetService(createBudgetRepository(database)),
          transactions: createTransactionService(createTransactionRepository(database)),
          goals: createGoalService(createGoalRepository(database), calendarToday),
          planning: createPlanningService(createPlanningAdapter(database)),
        },
        close: database.close,
      },
    };
  } catch (error) {
    let cleanupFailed = false;
    if (database) {
      try {
        await database.close();
      } catch {
        cleanupFailed = true;
      }
    }
    const unsupported =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'unsupported-schema';
    return {
      ok: false,
      error: {
        code: cleanupFailed
          ? 'startup-cleanup-failed'
          : unsupported
            ? 'unsupported-schema'
            : 'startup-unavailable',
        message: unsupported
          ? 'This data requires a newer version of Plan Bud. Update the app to continue.'
          : 'Unable to open your data. Close the app and try again. Your records have not been reset.',
      },
    };
  }
};
