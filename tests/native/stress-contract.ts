import { deleteDatabaseAsync } from 'expo-sqlite';
import { openDatabase } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';
import { createSnapshotRepository } from '@/domains/backup/infrastructure/snapshot-repository';
import { createGoalRepository } from '@/domains/goals/infrastructure/goal-repository';
import { validateSnapshot } from '@/domains/backup/application/validate-snapshot';
import { stressSnapshot } from '../helpers/snapshot-fixture';
import { isStorageFull } from '../helpers/is-storage-full';
import type { ContractReport } from './contract-report';

/** Exercises bounded large-data and actual SQLite-full failures in a separate native database.
 * @param onStage Receives sanitized stage names for diagnosing a stalled native operation.
 * @returns Sanitized results and elapsed milliseconds; never reads the user's product database.
 */
export const runStressContract = async (
  onStage: (stage: string) => void = () => {},
): Promise<ContractReport & { timings: Record<string, number> }> => {
  const name = `plan-bud-stress-${Date.now()}.db`;
  const database = await openDatabase(name);
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  const timings: Record<string, number> = {};
  try {
    onStage('migrate');
    await migrateDatabase(database);
    const source = stressSnapshot();
    const canonical = validateSnapshot(source);
    if (!canonical.ok) throw new Error('Invalid synthetic stress fixture.');
    const restore = createRestoreRepository(database);
    const start = Date.now();
    onStage('replace-50000');
    await restore.replace({
      snapshot: source,
      expectedRevision: 0,
      recovery: {
        profileId: source.profile.id,
        generation: 'synthetic-native-stress',
        fingerprint: '0'.repeat(64),
        status: 'pending',
      },
    });
    timings.replace = Date.now() - start;
    const readStart = Date.now();
    onStage('read-snapshot');
    const read = await createSnapshotRepository(database, () => source.createdAt).readConsistent();
    timings.snapshot = Date.now() - readStart;
    if (JSON.stringify(read.snapshot) !== JSON.stringify(canonical.value))
      throw new Error('Snapshot mismatch.');
    passed.push('native-50000-record-round-trip');
    const goalStart = Date.now();
    onStage('read-500-goals');
    const histories = await createGoalRepository(database).readGoals();
    timings.goals = Date.now() - goalStart;
    if (histories.length !== 500 || histories.some((item) => item.contributions.length !== 1))
      throw new Error('History mismatch.');
    passed.push('native-500-goal-histories');
    onStage('limit-database-pages');
    await database.schema(async (sql) => {
      await sql.batch('CREATE TABLE stress_payload(value BLOB);');
      const row = await sql.first('PRAGMA page_count');
      const pages = row?.page_count;
      if (typeof pages !== 'number') throw new Error('Invalid page count.');
      await sql.first(`PRAGMA max_page_count = ${pages + 4}`);
    });
    const revision = await database.revision();
    let full = false;
    onStage('force-sqlite-full');
    try {
      await database.write(async (sql) => {
        await sql.execute("UPDATE profiles SET locale='en-GB'");
        await sql.execute('INSERT INTO stress_payload(value) VALUES (zeroblob(1048576))');
        return { value: undefined, changed: true };
      });
    } catch (error) {
      full = isStorageFull(error);
    }
    onStage('read-after-full');
    const retained = await database.read(
      async (sql) => await sql.first('SELECT locale FROM profiles'),
    );
    const payload = await database.read(
      async (sql) => await sql.first('SELECT COUNT(*) AS count FROM stress_payload'),
    );
    if (
      !full ||
      retained?.locale !== source.profile.locale ||
      payload?.count !== 0 ||
      (await database.revision()) !== revision
    )
      throw new Error('Full database changed source records.');
    passed.push('native-sqlite-full-rollback');
    onStage('queue-after-full');
    const writes = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        database.write(async (sql) => {
          await sql.execute("UPDATE profiles SET locale='en-GB'");
          return { value: undefined, changed: true };
        }),
      ),
    );
    if (
      writes.some((result) => result.status === 'rejected') ||
      (await database.revision()) !== revision + 20
    )
      throw new Error('Queued writes failed after database full.');
    passed.push('native-post-full-20-queued-writes');
    await database.schema(async (sql) => {
      await sql.first('PRAGMA max_page_count = 2147483646');
    });
    const dense = stressSnapshot('goals');
    onStage('replace-dense-goals');
    await restore.replace({
      snapshot: dense,
      expectedRevision: await database.revision(),
      recovery: {
        profileId: dense.profile.id,
        generation: 'synthetic-dense-goal-stress',
        fingerprint: '0'.repeat(64),
        status: 'pending',
      },
    });
    const denseStart = Date.now();
    onStage('read-dense-goals');
    const denseHistories = await createGoalRepository(database).readGoals();
    timings.denseGoals = Date.now() - denseStart;
    if (
      denseHistories.length !== 24998 ||
      denseHistories.some((item) => item.contributions.length !== 1)
    )
      throw new Error('Dense history mismatch.');
    passed.push('native-24998-goal-histories');
  } catch {
    failed.push({ name: 'native-stress', code: 'contract-failed' });
  } finally {
    try {
      await database.close();
      await deleteDatabaseAsync(name);
    } catch {
      failed.push({ name: 'native-stress-cleanup', code: 'cleanup-failed' });
    }
  }
  return { passed, failed, timings };
};
