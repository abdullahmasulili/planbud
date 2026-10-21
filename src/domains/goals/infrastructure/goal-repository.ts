import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import { readCommand, recordCommand } from '@/shared/infrastructure/database/command-log';
import type { GoalPort } from '../application/goal-service';
import type { Goal } from '../domain/goal';
import { parseGoal, goalProgress } from '../domain/goal';
import type { Contribution } from '../domain/contribution';
import { parseContribution } from '../domain/contribution';
import { addAmounts } from '@/shared/domain/money';

const SELECT_GOALS =
  'SELECT id,name,target_amount AS target,starting_saved AS startingSaved,deadline,priority,desired_monthly AS desiredMonthly,goal_state AS state FROM goals';
const SELECT_CONTRIBUTIONS =
  'SELECT id,goal_id AS goalId,amount,record_date AS date FROM goal_contributions';

/** Checks persisted or replayed metadata through the canonical goal validator.
 * @param value Untrusted storage value.
 * @returns Canonical goal; rejects damaged storage.
 */
const decodeGoal = (value: unknown): Goal => {
  const parsed = parseGoal(value);
  if (!parsed.ok) throw new Error('Invalid stored goal.');
  return parsed.value;
};
/** Checks persisted or replayed earmarking through the canonical validator.
 * @param value Untrusted storage value.
 * @returns Canonical contribution; rejects damaged storage.
 */
const decodeContribution = (value: unknown): Contribution => {
  const parsed = parseContribution(value);
  if (!parsed.ok) throw new Error('Invalid stored contribution.');
  return parsed.value;
};
/** Reads source histories inside an already owned transaction.
 * @param sql Current consistent transaction capability.
 * @returns Validated goals with date/ID ordered history, including archived goals.
 */
export const readGoalHistories = async (sql: SqlExecutor) => {
  const goals = (await sql.all(`${SELECT_GOALS} ORDER BY id`)).map(decodeGoal);
  const contributions = (
    await sql.all(`${SELECT_CONTRIBUTIONS} ORDER BY record_date DESC,id DESC`)
  ).map(decodeContribution);
  const histories = new Map<string, Contribution[]>(goals.map((goal) => [goal.id, []]));
  for (const item of contributions) {
    const history = histories.get(item.goalId);
    if (!history) throw new Error('Missing contribution owner.');
    history.push(item);
  }
  return goals.map((goal) => ({
    goal,
    contributions: histories.get(goal.id) ?? [],
  }));
};
/** Checks the prospective savings sum before any source mutation commits.
 * @param sql Current write transaction.
 * @param goal Prospective source metadata.
 * @param replacement Optional contribution replacing the same stable ID.
 * @returns Completion or a rejected unsafe aggregate.
 */
const checkSavings = async (sql: SqlExecutor, goal: Goal, replacement?: Contribution) => {
  const records = (await sql.all(`${SELECT_CONTRIBUTIONS} WHERE goal_id=?`, [goal.id]))
    .map(decodeContribution)
    .filter((item) => item.id !== replacement?.id);
  const result = goalProgress(
    goal,
    replacement ? [...records, replacement] : records,
    '0001-01-01',
  );
  if (!result.ok)
    throw Object.assign(new Error('Invalid prospective goal savings.'), {
      code: result.error.code,
    });
};
/** Requires confirmed currency before accepting financial goal records.
 * @param sql Current transaction capability.
 * @returns Completion or an unconfirmed-profile rejection.
 */
const requireProfile = async (sql: SqlExecutor) => {
  if (!(await sql.first('SELECT id FROM profiles WHERE singleton=1')))
    throw new Error('Confirm currency before recording goals.');
};

/** Stores metadata and actual earmarking with atomic replay semantics and derived-total guards.
 * @param database Private serialized connection owned by app composition.
 * @returns Goal persistence port; never creates expense or planned-allocation records.
 */
export const createGoalRepository = (database: DatabaseHandle): GoalPort => ({
  /** Saves metadata without deleting history when state changes.
   * @param command Stable operation identity and canonical source metadata.
   * @returns Committed goal or original replay result.
   */
  saveGoal: async (command) => {
    const input = decodeGoal(command.input);
    return await database.write(async (sql) => {
      await requireProfile(sql);
      const replay = await readCommand(sql, command.operationId, 'goal.save', input);
      if (replay.found) return { value: decodeGoal(replay.value), changed: false };
      const row = await sql.first(`${SELECT_GOALS} WHERE id=?`, [input.id]);
      const existing = row ? decodeGoal(row) : null;
      await checkSavings(sql, input);
      const changed = JSON.stringify(existing) !== JSON.stringify(input);
      if (changed)
        await sql.execute(
          'INSERT INTO goals(id,name,target_amount,starting_saved,deadline,priority,desired_monthly,goal_state) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,target_amount=excluded.target_amount,starting_saved=excluded.starting_saved,deadline=excluded.deadline,priority=excluded.priority,desired_monthly=excluded.desired_monthly,goal_state=excluded.goal_state',
          [
            input.id,
            input.name,
            input.target,
            input.startingSaved,
            input.deadline,
            input.priority,
            input.desiredMonthly,
            input.state,
          ],
        );
      await recordCommand(sql, command.operationId, 'goal.save', input, input);
      return { value: input, changed };
    });
  },
  /** Corrects actual amount/date while preserving contribution ownership and history identity.
   * @param command Source contribution and stable replay identity.
   * @returns Committed contribution or original replay result.
   */
  saveContribution: async (command) => {
    const input = decodeContribution(command.input);
    return await database.write(async (sql) => {
      await requireProfile(sql);
      const replay = await readCommand(sql, command.operationId, 'contribution.save', input);
      if (replay.found) return { value: decodeContribution(replay.value), changed: false };
      const goalRow = await sql.first(`${SELECT_GOALS} WHERE id=?`, [input.goalId]);
      const row = await sql.first(`${SELECT_CONTRIBUTIONS} WHERE id=?`, [input.id]);
      const existing = row ? decodeContribution(row) : null;
      if (!goalRow || (existing && existing.goalId !== input.goalId))
        throw Object.assign(new Error('Invalid contribution owner.'), {
          code: 'invalid-reference',
        });
      await checkSavings(sql, decodeGoal(goalRow), input);
      const monthly = (
        await sql.all(`${SELECT_CONTRIBUTIONS} WHERE substr(record_date,1,7)=? AND id<>?`, [
          input.date.slice(0, 7),
          input.id,
        ])
      ).map(decodeContribution);
      if (!addAmounts([...monthly.map((item) => item.amount), input.amount]).ok)
        throw Object.assign(
          new Error('Monthly contributions exceed the supported range. Reduce the amount.'),
          { code: 'amount-overflow' },
        );
      const changed = JSON.stringify(existing) !== JSON.stringify(input);
      if (changed)
        await sql.execute(
          'INSERT INTO goal_contributions(id,goal_id,amount,record_date) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount,record_date=excluded.record_date',
          [input.id, input.goalId, input.amount, input.date],
        );
      await recordCommand(sql, command.operationId, 'contribution.save', input, input);
      return { value: input, changed };
    });
  },
  /** Deletes actual earmarking atomically and caches completion for safe retries.
   * @param command Stable deletion identity and contribution ID.
   * @returns Completion; repeated deletion does not advance financial revision.
   */
  removeContribution: async (command) => {
    await database.write(async (sql) => {
      await requireProfile(sql);
      const input = { id: command.input.id };
      const replay = await readCommand(sql, command.operationId, 'contribution.remove', input);
      if (replay.found) {
        if (replay.value !== null) throw new Error('Invalid cached deletion.');
        return { value: undefined, changed: false };
      }
      const row = await sql.first('SELECT id FROM goal_contributions WHERE id=?', [input.id]);
      if (row) await sql.execute('DELETE FROM goal_contributions WHERE id=?', [input.id]);
      await recordCommand(sql, command.operationId, 'contribution.remove', input, null);
      return { value: undefined, changed: row !== null };
    });
  },
  /** Reads all source goals and histories from one consistent SQLite snapshot.
   * @returns Validated metadata and contribution history with no redundant stored totals.
   */
  readGoals: async () => await database.read(readGoalHistories),
});
