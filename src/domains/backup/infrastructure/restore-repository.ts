import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import { isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import type { RestorePort } from '../application/restore-service';
import { validateSnapshot } from '../application/validate-snapshot';
import { readRecoveryMetadata } from './recovery-metadata';

const DELETE_SOURCE = [
  'DELETE FROM commands',
  'DELETE FROM named_plan_items',
  'DELETE FROM named_plans',
  'DELETE FROM goal_allocations',
  'DELETE FROM goal_contributions',
  'DELETE FROM transactions',
  'DELETE FROM category_limits',
  'DELETE FROM monthly_plans',
  'DELETE FROM categories',
  'DELETE FROM goals',
  'DELETE FROM profiles',
];

/** Owns atomic replacement with pending recovery binding and no plaintext filesystem staging.
 * @param database Private serialized app database.
 * @returns Revision-checked replace/readiness/reset capabilities; failed writes roll back all data.
 */
export const createRestoreRepository = (database: DatabaseHandle): RestorePort => ({
  /** Reads the revision against which the user will review destructive replacement.
   * @returns Current exact global source revision.
   */
  revision: database.revision,
  /** Revalidates and replaces every source table plus a pending generation in one transaction.
   * @param input Complete portable snapshot, reviewed revision, and nonsecret recovery binding.
   * @returns Completion; no protected key bytes enter SQLite and no partial replacement survives failure.
   */
  replace: async (input) => {
    const parsed = validateSnapshot(input.snapshot);
    const recovery = input.recovery;
    if (
      !parsed.ok ||
      recovery.profileId !== parsed.value.profile.id ||
      recovery.status !== 'pending' ||
      !isText(recovery.generation, MAX_ID_LENGTH) ||
      !/^[a-f0-9]{64}$/.test(recovery.fingerprint)
    )
      throw new Error('Invalid replacement snapshot or recovery binding.');
    const snapshot = parsed.value;
    await database.write(
      async (sql) => {
        if ((await readRevision(sql)) !== input.expectedRevision)
          throw Object.assign(new Error('Restore inputs changed.'), { code: 'stale-data' });
        for (const statement of DELETE_SOURCE) await sql.execute(statement);
        const profile = snapshot.profile;
        await sql.execute(
          'INSERT INTO profiles(singleton,id,currency_code,currency_exponent,locale,appearance) VALUES (1,?,?,?,?,?)',
          [
            profile.id,
            profile.currency.code,
            profile.currency.exponent,
            profile.locale,
            profile.appearance,
          ],
        );
        for (const category of snapshot.categories)
          await sql.execute('INSERT INTO categories(id,name,kind,archived) VALUES (?,?,?,?)', [
            category.id,
            category.name,
            category.kind,
            category.archived ? 1 : 0,
          ]);
        for (const plan of snapshot.plans) {
          await sql.execute('INSERT INTO monthly_plans(month,planned_income) VALUES (?,?)', [
            plan.month,
            plan.plannedIncome,
          ]);
          for (const limit of plan.limits)
            await sql.execute(
              'INSERT INTO category_limits(month,category_id,amount) VALUES (?,?,?)',
              [plan.month, limit.categoryId, limit.amount],
            );
        }
        if (snapshot.schemaVersion === 2)
          for (const plan of snapshot.namedPlans) {
            await sql.execute('INSERT INTO named_plans(id,name,funding) VALUES (?,?,?)', [
              plan.id,
              plan.name,
              plan.funding,
            ]);
            for (const [position, item] of plan.items.entries())
              await sql.execute(
                'INSERT INTO named_plan_items(plan_id,id,name,amount,position) VALUES (?,?,?,?,?)',
                [plan.id, item.id, item.name, item.amount, position],
              );
          }
        for (const transaction of snapshot.transactions)
          await sql.execute(
            'INSERT INTO transactions(id,type,amount,record_date,category_id,note) VALUES (?,?,?,?,?,?)',
            [
              transaction.id,
              transaction.type,
              transaction.amount,
              transaction.date,
              transaction.categoryId,
              transaction.note,
            ],
          );
        for (const goal of snapshot.goals)
          await sql.execute(
            'INSERT INTO goals(id,name,target_amount,starting_saved,deadline,priority,desired_monthly,goal_state) VALUES (?,?,?,?,?,?,?,?)',
            [
              goal.id,
              goal.name,
              goal.target,
              goal.startingSaved,
              goal.deadline,
              goal.priority,
              goal.desiredMonthly,
              goal.state,
            ],
          );
        for (const contribution of snapshot.contributions)
          await sql.execute(
            'INSERT INTO goal_contributions(id,goal_id,amount,record_date) VALUES (?,?,?,?)',
            [contribution.id, contribution.goalId, contribution.amount, contribution.date],
          );
        for (const allocation of snapshot.allocations)
          await sql.execute('INSERT INTO goal_allocations(month,goal_id,amount) VALUES (?,?,?)', [
            allocation.month,
            allocation.goalId,
            allocation.amount,
          ]);
        await sql.execute(
          'UPDATE app_metadata SET recovery_generation=?,recovery_fingerprint=?,recovery_status=? WHERE singleton=1',
          [recovery.generation, recovery.fingerprint, 'pending'],
        );
        return { value: undefined, changed: true };
      },
      { replaceSession: true },
    );
  },
  /** Marks readiness only for the generation adopted by the protected-secret workflow.
   * @param ref Exact committed profile/generation reference.
   * @returns Completion; mismatches never enable export for another profile or generation.
   */
  markRecoveryReady: async (ref) => {
    await database.write(async (sql) => {
      const current = await readRecoveryMetadata(sql);
      if (
        !current.state ||
        current.profileId !== ref.profileId ||
        current.state.generation !== ref.generation
      )
        throw new Error('Recovery generation changed.');
      if (current.state.status === 'ready') return { value: undefined, changed: false };
      await sql.execute("UPDATE app_metadata SET recovery_status='ready' WHERE singleton=1");
      return { value: undefined, changed: true };
    });
  },
  /** Clears app-private financial data only after the explicit application confirmation gate.
   * @param expectedRevision Revision observed immediately before the destructive action.
   * @returns Completion; external encrypted files are never accessed or deleted.
   */
  reset: async (expectedRevision) => {
    await database.write(
      async (sql) => {
        if ((await readRevision(sql)) !== expectedRevision)
          throw Object.assign(new Error('Data changed before clearing.'), { code: 'stale-data' });
        for (const statement of DELETE_SOURCE) await sql.execute(statement);
        await sql.execute(
          'UPDATE app_metadata SET recovery_generation=NULL,recovery_fingerprint=NULL,recovery_status=NULL WHERE singleton=1',
        );
        return { value: undefined, changed: true };
      },
      { replaceSession: true },
    );
  },
});
