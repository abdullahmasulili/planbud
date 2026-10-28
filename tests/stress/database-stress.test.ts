import { stressSnapshot } from '../helpers/snapshot-fixture';
import { createTransactionFixture } from '../helpers/transaction-fixture';
import { validateSnapshot } from '@/domains/backup/application/validate-snapshot';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';
import { createSnapshotRepository } from '@/domains/backup/infrastructure/snapshot-repository';
import { createGoalRepository } from '@/domains/goals/infrastructure/goal-repository';
import { isStorageFull } from '../helpers/is-storage-full';

it('BACKUP-005 round-trips the 50,000-record limit and rejects one extra record without mutation', async () => {
  const fixture = await createTransactionFixture();
  try {
    const snapshot = stressSnapshot();
    expect(validateSnapshot(snapshot).ok).toBe(true);
    const repository = createRestoreRepository(fixture.database);
    await repository.replace({
      snapshot,
      expectedRevision: await fixture.database.revision(),
      recovery: {
        profileId: snapshot.profile.id,
        generation: 'synthetic-stress-generation',
        fingerprint: '0'.repeat(64),
        status: 'pending',
      },
    });
    const revision = await fixture.database.revision();
    const read = createSnapshotRepository(fixture.database, () => snapshot.createdAt);
    expect((await read.readConsistent()).snapshot).toEqual({
      ...snapshot,
      schemaVersion: 2,
      namedPlans: [],
    });
    const category = snapshot.categories[0];
    if (!category) throw new Error('Missing synthetic category.');
    const oversized = {
      ...snapshot,
      categories: [...snapshot.categories, { ...category, id: 'extra' }],
    };
    expect(validateSnapshot(oversized)).toMatchObject({
      ok: false,
      error: { code: 'snapshot-limit' },
    });
    await expect(
      repository.replace({
        snapshot: oversized,
        expectedRevision: revision,
        recovery: {
          profileId: snapshot.profile.id,
          generation: 'oversized',
          fingerprint: '0'.repeat(64),
          status: 'pending',
        },
      }),
    ).rejects.toThrow();
    expect(await fixture.database.revision()).toBe(revision);
    expect((await read.readConsistent()).snapshot).toEqual({
      ...snapshot,
      schemaVersion: 2,
      namedPlans: [],
    });
    const histories = await createGoalRepository(fixture.database).readGoals();
    expect(histories).toHaveLength(500);
  } finally {
    await fixture.database.close();
  }
}, 30000);

it('DATA-002 rolls back a real SQLITE_FULL failure and accepts the next queued write', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.database.schema(async (sql) => {
      await sql.batch('CREATE TABLE stress_payload(value BLOB);');
      const row = await sql.first('PRAGMA page_count');
      const pages = row?.page_count;
      if (typeof pages !== 'number') throw new Error('Invalid page count.');
      await sql.first(`PRAGMA max_page_count = ${pages + 4}`);
    });
    const before = await fixture.database.revision();
    let full = false;
    try {
      await fixture.database.write(async (sql) => {
        await sql.execute("UPDATE profiles SET locale='en-GB'");
        await sql.execute('INSERT INTO stress_payload(value) VALUES (zeroblob(1048576))');
        return { value: undefined, changed: true };
      });
    } catch (error) {
      full = isStorageFull(error);
    }
    expect(full).toBe(true);
    expect(await fixture.database.revision()).toBe(before);
    expect(
      await fixture.database.read(async (sql) => await sql.first('SELECT locale FROM profiles')),
    ).toEqual({ locale: 'en-US' });
    expect(
      await fixture.database.read(
        async (sql) => await sql.first('SELECT COUNT(*) AS count FROM stress_payload'),
      ),
    ).toEqual({ count: 0 });
    await fixture.database.write(async (sql) => {
      await sql.execute("UPDATE profiles SET locale='en-GB'");
      return { value: undefined, changed: true };
    });
    expect(await fixture.database.revision()).toBe(before + 1);
  } finally {
    await fixture.database.close();
  }
});
