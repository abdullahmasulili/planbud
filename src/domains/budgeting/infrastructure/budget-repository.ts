import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import type { BudgetPort } from '../application/budget-service';
import { parseCategory } from '../domain/category';
import type { Category } from '../domain/category';
import { parseMonthlyPlan } from '../domain/monthly-plan';
import type { MonthlyPlan } from '../domain/monthly-plan';

/** Rejects financial writes before the profile's currency has been confirmed.
 * @param sql Current transaction capability.
 * @returns Completion or a rejected unconfirmed-profile operation.
 */
const requireProfile = async (sql: SqlExecutor) => {
  if (!(await sql.first('SELECT id FROM profiles WHERE singleton=1')))
    throw new Error('Confirm currency before planning.');
};

/** Reads category rows through their authoritative domain validator.
 * @param sql Consistent transaction capability.
 * @returns Stable category order, retaining archived metadata.
 */
export const readCategories = async (sql: SqlExecutor): Promise<readonly Category[]> => {
  const rows = await sql.all('SELECT id,name,kind,archived FROM categories ORDER BY id');
  return rows.map((row) => {
    if (row.archived !== 0 && row.archived !== 1)
      throw new Error('Invalid category archive state.');
    const parsed = parseCategory({
      id: row.id,
      name: row.name,
      kind: row.kind,
      archived: row.archived === 1,
    });
    if (!parsed.ok) throw new Error('Invalid stored category.');
    return parsed.value;
  });
};

/** Reads one month's source estimates within an existing transaction.
 * @param sql Consistent transaction capability.
 * @param month Calendar month key.
 * @returns Validated stored estimates, with zero defaults for an unplanned month.
 */
export const readPlan = async (sql: SqlExecutor, month: string): Promise<MonthlyPlan> => {
  const row = await sql.first('SELECT planned_income FROM monthly_plans WHERE month=?', [month]);
  const limits = await sql.all(
    'SELECT category_id,amount FROM category_limits WHERE month=? ORDER BY category_id',
    [month],
  );
  const parsed = parseMonthlyPlan({
    month,
    plannedIncome: row?.planned_income ?? 0,
    limits: limits.map((limit) => ({ categoryId: limit.category_id, amount: limit.amount })),
  });
  if (!parsed.ok) throw new Error('Invalid stored plan.');
  return parsed.value;
};

/** Implements atomic plan replacement with revision checks and bound SQL values.
 * @param database Private lifecycle-owned database handle.
 * @returns The budgeting application's durable port.
 */
export const createBudgetRepository = (database: DatabaseHandle): BudgetPort => ({
  /** Creates or edits metadata while preserving historical references.
   * @param category Canonical category input.
   * @returns The committed category; identical retries leave revision unchanged.
   */
  saveCategory: async (category) => {
    const parsed = parseCategory(category);
    if (!parsed.ok) throw new Error('Invalid category.');
    return await database.write(async (sql) => {
      await requireProfile(sql);
      const existing = (await readCategories(sql)).find((entry) => entry.id === category.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(parsed.value))
        return { value: existing, changed: false };
      await sql.execute(
        'INSERT INTO categories(id,name,kind,archived) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,archived=excluded.archived',
        [category.id, parsed.value.name, category.kind, category.archived ? 1 : 0],
      );
      return { value: parsed.value, changed: true };
    });
  },
  /** Atomically replaces one month's estimates after checking all category references.
   * @param input Proposed plan and revision the user reviewed.
   * @returns Committed plan version; rejects stale or invalid input without changes.
   */
  savePlan: async (input) => {
    const parsed = parseMonthlyPlan(input.plan);
    if (!parsed.ok) throw new Error('Invalid monthly plan.');
    return await database.write(async (sql) => {
      await requireProfile(sql);
      const revision = await readRevision(sql);
      if (revision !== input.expectedRevision)
        throw Object.assign(new Error('Budget inputs changed.'), { code: 'stale-data' });
      const categories = new Set((await readCategories(sql)).map((category) => category.id));
      if (parsed.value.limits.some((limit) => !categories.has(limit.categoryId)))
        throw new Error('Category reference is missing.');
      const plan = {
        ...parsed.value,
        limits: [...parsed.value.limits].sort((a, b) =>
          a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0,
        ),
      };
      const before = await readPlan(sql, plan.month);
      const exists = await sql.first('SELECT month FROM monthly_plans WHERE month=?', [plan.month]);
      if (exists && JSON.stringify(before) === JSON.stringify(plan))
        return { value: { plan, revision }, changed: false };
      await sql.execute(
        'INSERT INTO monthly_plans(month,planned_income) VALUES (?,?) ON CONFLICT(month) DO UPDATE SET planned_income=excluded.planned_income',
        [plan.month, plan.plannedIncome],
      );
      await sql.execute('DELETE FROM category_limits WHERE month=?', [plan.month]);
      for (const limit of plan.limits)
        await sql.execute('INSERT INTO category_limits(month,category_id,amount) VALUES (?,?,?)', [
          plan.month,
          limit.categoryId,
          limit.amount,
        ]);
      return { value: { plan, revision: revision + 1 }, changed: true };
    });
  },
  /** Reads plan and revision in the same transaction.
   * @param month Calendar month selected by the user.
   * @returns A read-consistent versioned plan.
   */
  readMonth: async (month) =>
    await database.read(async (sql) => ({
      plan: await readPlan(sql, month),
      revision: await readRevision(sql),
    })),
  /** Reads active and archived categories in stable order.
   * @returns Category metadata preserving history.
   */
  readCategories: async () => await database.read(readCategories),
});
