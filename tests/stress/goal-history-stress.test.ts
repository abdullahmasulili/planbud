import { stressSnapshot } from '../helpers/snapshot-fixture';
import { createTransactionFixture } from '../helpers/transaction-fixture';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';
import {
  createGoalRepository,
  readGoalHistories,
} from '@/domains/goals/infrastructure/goal-repository';

it('GOAL-001 preserves date/ID history ordering and rejects an orphan instead of dropping it', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.database.write(async (sql) => {
      for (const id of ['empty', 'populated'])
        await sql.execute(
          "INSERT INTO goals(id,name,target_amount,starting_saved,deadline,priority,desired_monthly,goal_state) VALUES (?,?,100,0,NULL,'high',NULL,'active')",
          [id, id],
        );
      for (const { id, date } of [
        { id: 'a', date: '2026-10-20' },
        { id: 'b', date: '2026-10-20' },
        { id: 'c', date: '2026-10-19' },
      ])
        await sql.execute(
          'INSERT INTO goal_contributions(id,goal_id,amount,record_date) VALUES (?,?,?,?)',
          [id, 'populated', 1, date],
        );
      return { value: undefined, changed: true };
    });
    const histories = await createGoalRepository(fixture.database).readGoals();
    expect(
      histories.map((item) => [item.goal.id, item.contributions.map((record) => record.id)]),
    ).toEqual([
      ['empty', []],
      ['populated', ['b', 'a', 'c']],
    ]);
    await expect(
      fixture.database.read(
        async (sql) =>
          await readGoalHistories({
            ...sql,
            /** Injects damaged storage output without changing the underlying foreign-key-protected records.
             * @param statement Source query under test.
             * @param parameters Bound query values.
             * @returns Actual rows with a deliberately missing owner in contribution output only.
             */
            all: async (statement, parameters) =>
              (await sql.all(statement, parameters)).map((row) =>
                'goalId' in row ? { ...row, goalId: 'missing' } : row,
              ),
          }),
      ),
    ).rejects.toThrow('Missing contribution owner.');
  } finally {
    await fixture.database.close();
  }
});

it('GOAL-001 preserves every history in a relationship-heavy 50,000-record dataset', async () => {
  const fixture = await createTransactionFixture();
  try {
    const snapshot = stressSnapshot('goals');
    await createRestoreRepository(fixture.database).replace({
      snapshot,
      expectedRevision: await fixture.database.revision(),
      recovery: {
        profileId: snapshot.profile.id,
        generation: 'synthetic-dense-goals',
        fingerprint: '0'.repeat(64),
        status: 'pending',
      },
    });
    const start = performance.now();
    const histories = await createGoalRepository(fixture.database).readGoals();
    const elapsed = performance.now() - start;
    expect(histories).toHaveLength(24998);
    expect(
      histories.every(
        (item) => item.contributions.length === 1 && item.contributions[0]?.goalId === item.goal.id,
      ),
    ).toBe(true);
    process.stdout.write(`Synthetic dense-goal projection: ${Math.round(elapsed)} ms.\n`);
    expect(elapsed).toBeLessThan(5000);
  } finally {
    await fixture.database.close();
  }
}, 120000);
