import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import type { NamedPlanPort } from '../application/named-plan-service';
import { parseNamedPlan } from '../domain/named-plan';
import type { NamedPlan } from '../domain/named-plan';

/** Reads and validates independent estimates inside an existing consistent transaction.
 * @param sql Transaction-scoped read capability.
 * @returns Canonical named plans ordered by stable identity; damaged rows reject.
 */
export const readNamedPlans = async (sql: SqlExecutor): Promise<readonly NamedPlan[]> => {
  const plans = await sql.all('SELECT id,name,funding FROM named_plans ORDER BY id');
  const items = await sql.all(
    'SELECT plan_id,id,name,amount FROM named_plan_items ORDER BY position',
  );
  return plans.map((plan) => {
    const parsed = parseNamedPlan({
      ...plan,
      items: items
        .filter((item) => item.plan_id === plan.id)
        .map((item) => ({ id: item.id, name: item.name, amount: item.amount })),
    });
    if (!parsed.ok) throw new Error('Invalid stored named plan.');
    return parsed.value;
  });
};

/** Checks the confirmed profile and optimistic source revision within the write transaction.
 * @param sql Serialized transaction capability.
 * @param expectedRevision Revision shown before editing or deletion.
 * @returns Completion or rejection before any mutation.
 */
const requireCurrent = async (sql: SqlExecutor, expectedRevision: number) => {
  if (!(await sql.first('SELECT id FROM profiles WHERE singleton=1')))
    throw new Error('Confirm currency before planning.');
  if ((await readRevision(sql)) !== expectedRevision)
    throw Object.assign(new Error('Plan inputs changed.'), { code: 'stale-data' });
};

/** Implements atomic named-plan replacement with parameterized values and source revision checks.
 * @param database Lifecycle-owned app database.
 * @returns Durable named-plan port; no monthly data is mutated.
 */
export const createNamedPlanRepository = (database: DatabaseHandle): NamedPlanPort => ({
  /** Reads all estimates and the matching revision.
   * @returns Consistent replaceable projection.
   */
  read: async () =>
    await database.read(async (sql) => ({
      plans: await readNamedPlans(sql),
      revision: await readRevision(sql),
    })),
  /** Replaces one plan and its estimates atomically; identical retries do not advance revision.
   * @param input Canonical draft and original revision.
   * @returns Completion; stale, invalid, or failed writes reject and roll back.
   */
  save: async (input) => {
    const parsed = parseNamedPlan(input.plan);
    if (!parsed.ok) throw new Error('Invalid named plan.');
    const plan = parsed.value;
    await database.write(async (sql) => {
      await requireCurrent(sql, input.expectedRevision);
      const existing = (await readNamedPlans(sql)).find((item) => item.id === plan.id);
      if (JSON.stringify(existing) === JSON.stringify(plan))
        return { value: undefined, changed: false };
      await sql.execute(
        'INSERT INTO named_plans(id,name,funding) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,funding=excluded.funding',
        [plan.id, plan.name, plan.funding],
      );
      await sql.execute('DELETE FROM named_plan_items WHERE plan_id=?', [plan.id]);
      for (const [position, item] of plan.items.entries())
        await sql.execute(
          'INSERT INTO named_plan_items(plan_id,id,name,amount,position) VALUES (?,?,?,?,?)',
          [plan.id, item.id, item.name, item.amount, position],
        );
      return { value: undefined, changed: true };
    });
  },
  /** Deletes one confirmed plan atomically, leaving every other source record intact.
   * @param input Plan identity and reviewed revision.
   * @returns Completion or stale/storage rejection.
   */
  remove: async (input) => {
    await database.write(async (sql) => {
      await requireCurrent(sql, input.expectedRevision);
      const existing = await sql.first('SELECT id FROM named_plans WHERE id=?', [input.id]);
      if (!existing) return { value: undefined, changed: false };
      await sql.execute('DELETE FROM named_plan_items WHERE plan_id=?', [input.id]);
      await sql.execute('DELETE FROM named_plans WHERE id=?', [input.id]);
      return { value: undefined, changed: true };
    });
  },
});
