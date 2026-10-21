import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import { MAX_SNAPSHOT_RECORDS } from '@/shared/domain/record-limits';
import { validateSnapshot } from '../application/validate-snapshot';
import type { SnapshotPort } from '../application/snapshot';

/** Reads all portable source tables in one serialized transaction, bounded before validation.
 * @param database Private lifecycle-owned database.
 * @param now UTC ISO audit clock injected by composition, independent of calendar record dates.
 * @returns A same-revision snapshot port with the canonical outgoing/import validation gate.
 */
export const createSnapshotRepository = (
  database: DatabaseHandle,
  now: () => string,
): SnapshotPort => ({
  /** Produces complete source data without recovery bindings, command logs or derived totals.
   * @returns Consistent snapshot/revision; rejects excessive or malformed records without truncation.
   */
  readConsistent: async () =>
    await database.read(async (sql) => {
      const profile = await sql.first(
        'SELECT id,currency_code,currency_exponent,locale,appearance FROM profiles WHERE singleton=1',
      );
      if (!profile) throw new Error('Confirm currency before creating a snapshot.');
      let count = 0;
      /** Bounds each source table and the running complete-record count before further reads.
       * @param statement Trusted source projection SQL, with no user-controlled identifiers.
       * @returns Raw source rows or an excessive-record rejection.
       */
      const readRows = async (statement: string) => {
        const rows = await sql.all(statement + ' LIMIT ?', [MAX_SNAPSHOT_RECORDS + 1]);
        count += rows.length;
        if (count > MAX_SNAPSHOT_RECORDS)
          throw Object.assign(new Error('Snapshot record limit exceeded.'), {
            code: 'snapshot-limit',
          });
        return rows;
      };
      const categories = await readRows('SELECT id,name,kind,archived FROM categories ORDER BY id');
      const plans = await readRows(
        'SELECT month,planned_income AS plannedIncome FROM monthly_plans ORDER BY month',
      );
      const limits = await readRows(
        'SELECT month,category_id AS categoryId,amount FROM category_limits ORDER BY month,category_id',
      );
      const transactions = await readRows(
        'SELECT id,type,amount,record_date AS date,category_id AS categoryId,note FROM transactions ORDER BY id',
      );
      const goals = await readRows(
        'SELECT id,name,target_amount AS target,starting_saved AS startingSaved,deadline,priority,desired_monthly AS desiredMonthly,goal_state AS state FROM goals ORDER BY id',
      );
      const contributions = await readRows(
        'SELECT id,goal_id AS goalId,amount,record_date AS date FROM goal_contributions ORDER BY id',
      );
      const allocations = await readRows(
        'SELECT month,goal_id AS goalId,amount FROM goal_allocations ORDER BY month,goal_id',
      );
      if (categories.some((item) => item.archived !== 0 && item.archived !== 1))
        throw new Error('Invalid archived category.');
      const result = validateSnapshot({
        schemaVersion: 1,
        createdAt: now(),
        profile: {
          id: profile.id,
          currency: { code: profile.currency_code, exponent: profile.currency_exponent },
          locale: profile.locale,
          appearance: profile.appearance,
        },
        categories: categories.map((item) => ({ ...item, archived: item.archived === 1 })),
        plans: plans.map((plan) => ({
          ...plan,
          limits: limits
            .filter((item) => item.month === plan.month)
            .map((item) => ({ categoryId: item.categoryId, amount: item.amount })),
        })),
        transactions,
        goals,
        contributions,
        allocations,
      });
      if (!result.ok)
        throw Object.assign(new Error('Invalid outgoing snapshot.'), { code: result.error.code });
      return { snapshot: result.value, revision: await readRevision(sql) };
    }),
});
