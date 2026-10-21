import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import { addAmounts } from '@/shared/domain/money';
import { readCategories, readPlan } from '@/domains/budgeting/infrastructure/budget-repository';
import { readMonthlyTransactions } from '@/domains/transactions/infrastructure/transaction-repository';
import { summarizeTransactions } from '@/domains/transactions/domain/summary';
import { readGoalHistories } from '@/domains/goals/infrastructure/goal-repository';
import { goalProgress } from '@/domains/goals/application/public';
import { allocateGoals } from '@/domains/budgeting/domain/allocate-goals';
import { adjustPlanningInput } from '@/domains/budgeting/domain/planning-adjustments';
import type {
  PlanningInput,
  PlanningPorts,
} from '@/domains/budgeting/application/planning-contract';

/** Maps source records from one transaction into the budgeting-owned calculation contract.
 * @param sql Current consistent read/write capability.
 * @param month Requested calendar month.
 * @returns Validated deterministic inputs; rejects unsafe source aggregates.
 */
const readInput = async (sql: SqlExecutor, month: string): Promise<PlanningInput> => {
  const plan = await readPlan(sql, month);
  const categories = await readCategories(sql);
  const actuals = summarizeTransactions(await readMonthlyTransactions(sql, month));
  if (!actuals.ok) throw new Error('Unsafe transaction totals.');
  const histories = await readGoalHistories(sql);
  const monthly = addAmounts(
    histories.flatMap((history) =>
      history.contributions
        .filter((item) => item.date.slice(0, 7) === month)
        .map((item) => item.amount),
    ),
  );
  if (!monthly.ok) throw new Error('Unsafe contribution total.');
  const goals: PlanningInput['goals'][number][] = [];
  for (const history of histories) {
    const progress = goalProgress(history.goal, history.contributions, month + '-01');
    if (!progress.ok) throw new Error('Invalid goal history.');
    const goal = progress.value;
    goals.push({
      id: goal.id,
      state: goal.state,
      remaining: goal.remaining,
      deadline: goal.deadline,
      priority: goal.priority,
      desiredMonthly: goal.desiredMonthly,
    });
  }
  return {
    month,
    revision: await readRevision(sql),
    plannedIncome: plan.plannedIncome,
    categories: categories.map((category) => ({
      id: category.id,
      kind: category.kind,
      limit: plan.limits.find((item) => item.categoryId === category.id)?.amount ?? 0,
      spent: actuals.value.byCategory.find((item) => item.categoryId === category.id)?.amount ?? 0,
    })),
    contributionsThisMonth: monthly.value,
    goals,
  };
};

/** Owns the cross-domain consistent-read and atomic planning-commit boundary.
 * @param database Private serialized database lifecycle.
 * @returns Consumer-owned ports with a second revision check and recalculation inside commit.
 */
export const createPlanningAdapter = (database: DatabaseHandle): PlanningPorts => ({
  /** Reads financial inputs under one source revision.
   * @param month Requested calendar month.
   * @returns Consistent source-derived inputs.
   */
  readInput: async (month) => await database.read(async (sql) => await readInput(sql, month)),
  /** Atomically replaces selected limits and planned allocations after recalculation.
   * @param input Reviewed revision, cuts and expected allocations.
   * @returns Completion; rejects intervening writes, invalid edits, or altered calculations.
   */
  commit: async (input) => {
    await database.write(async (sql) => {
      const current = await readInput(sql, input.month);
      if (current.revision !== input.expectedRevision)
        throw Object.assign(new Error('Planning inputs changed.'), { code: 'stale-data' });
      if (!(await sql.first('SELECT id FROM profiles WHERE singleton=1')))
        throw new Error('Confirm currency before planning.');
      const adjusted = adjustPlanningInput(current, input.edits);
      if (!adjusted.ok) throw new Error('Invalid selected cuts.');
      const calculated = allocateGoals(adjusted.value);
      if (
        !calculated.ok ||
        JSON.stringify(
          calculated.value.allocations.map((row) => ({
            goalId: row.goalId,
            amount: row.allocated,
          })),
        ) !== JSON.stringify(input.allocations)
      )
        throw new Error('Invalid planned allocations.');
      await sql.execute('INSERT OR IGNORE INTO monthly_plans(month,planned_income) VALUES (?,?)', [
        input.month,
        current.plannedIncome,
      ]);
      for (const edit of input.edits)
        await sql.execute(
          'INSERT INTO category_limits(month,category_id,amount) VALUES (?,?,?) ON CONFLICT(month,category_id) DO UPDATE SET amount=excluded.amount',
          [input.month, edit.categoryId, edit.amount],
        );
      await sql.execute('DELETE FROM goal_allocations WHERE month=?', [input.month]);
      for (const allocation of input.allocations)
        await sql.execute('INSERT INTO goal_allocations(month,goal_id,amount) VALUES (?,?,?)', [
          input.month,
          allocation.goalId,
          allocation.amount,
        ]);
      return { value: undefined, changed: true };
    });
  },
});
