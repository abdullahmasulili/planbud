import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { snapshotFixture } from '../../../../tests/helpers/snapshot-fixture';
import { createSnapshotRepository } from './snapshot-repository';
import { createRestoreRepository } from './restore-repository';
import { createRecoveryMetadata } from './recovery-metadata';
import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';

it('DATA-001 preserves queued edits after rollback and invalidates them after committed reset', async () => {
  const fixture = await createTransactionFixture();
  try {
    const before = await fixture.database.revision();
    const record = {
      id: 'income',
      type: 'income',
      amount: 1000,
      categoryId: null,
      date: '2026-10-20',
      note: '',
    } satisfies Parameters<typeof fixture.transactions.save>[0]['input'];
    const failed = fixture.database.write(
      async (sql) => {
        await sql.execute("UPDATE profiles SET appearance='dark' WHERE singleton=1");
        throw new Error('Injected rollback.');
      },
      { replaceSession: true },
    );
    const retained = fixture.transactions.save({ operationId: 'after-rollback', input: record });
    await expect(failed).rejects.toThrow('Injected rollback.');
    expect(await retained).toMatchObject({ ok: true });
    expect(await fixture.database.revision()).toBe(before + 1);
    const clearing = createRestoreRepository(fixture.database).reset(before + 1);
    const obsolete = fixture.transactions.save({
      operationId: 'queued-after-reset',
      input: { ...record, id: 'obsolete' },
    });
    await clearing;
    expect(await obsolete).toMatchObject({ ok: false, error: { code: 'stale-data' } });
    expect(await fixture.database.revision()).toBe(before + 2);
  } finally {
    await fixture.database.close();
  }
});

it('RESTORE-003 rejects old-session writes queued behind a committed replacement', async () => {
  const fixture = await createTransactionFixture();
  try {
    const snapshot = snapshotFixture();
    const revision = await fixture.database.revision();
    const replacing = createRestoreRepository(fixture.database).replace({
      snapshot,
      expectedRevision: revision,
      recovery: {
        profileId: snapshot.profile.id,
        generation: 'replacement',
        fingerprint: '1'.repeat(64),
        status: 'pending',
      },
    });
    const oldAction = fixture.transactions.save({
      operationId: 'old-ui-action',
      input: {
        id: 'old-ui-income',
        type: 'income',
        amount: 1000,
        categoryId: null,
        date: '2026-10-20',
        note: '',
      },
    });
    await replacing;
    expect(await oldAction).toMatchObject({ ok: false, error: { code: 'stale-data' } });
    expect(await fixture.database.revision()).toBe(revision + 1);
    expect(
      (await createSnapshotRepository(fixture.database, () => snapshot.createdAt).readConsistent())
        .snapshot,
    ).toEqual(snapshot);
  } finally {
    await fixture.database.close();
  }
});

it('RESTORE-003 replaces every portable field once and persists pending recovery metadata in that same transaction', async () => {
  const fixture = await createTransactionFixture();
  try {
    const snapshot = snapshotFixture();
    const repository = createRestoreRepository(fixture.database);
    const revision = await fixture.database.revision();
    const input = {
      snapshot,
      expectedRevision: revision,
      recovery: {
        profileId: snapshot.profile.id,
        generation: 'new-generation',
        fingerprint: '1'.repeat(64),
        status: 'pending',
      },
    };
    await repository.replace({ ...input, recovery: { ...input.recovery, status: 'pending' } });
    expect(await fixture.database.revision()).toBe(revision + 1);
    expect(
      (await createSnapshotRepository(fixture.database, () => snapshot.createdAt).readConsistent())
        .snapshot,
    ).toEqual(snapshot);
    expect(await createRecoveryMetadata(fixture.database).read()).toMatchObject({
      profileId: snapshot.profile.id,
      state: { generation: 'new-generation', status: 'pending' },
    });
    await expect(
      repository.replace({ ...input, recovery: { ...input.recovery, status: 'pending' } }),
    ).rejects.toMatchObject({ code: 'stale-data' });
    await expect(
      repository.markRecoveryReady({
        profileId: snapshot.profile.id,
        generation: 'old-generation',
      }),
    ).rejects.toThrow();
    await repository.markRecoveryReady({
      profileId: snapshot.profile.id,
      generation: 'new-generation',
    });
    expect(await createRecoveryMetadata(fixture.database).read()).toMatchObject({
      state: { status: 'ready' },
    });
  } finally {
    await fixture.database.close();
  }
});

it('DATA-001 rolls back all replacement writes and pending metadata at every injected SQL failure', async () => {
  let totalStatements = 0;
  for (let failureAt = 1; failureAt <= Math.max(1, totalStatements); failureAt += 1) {
    const fixture = await createTransactionFixture();
    try {
      const snapshots = createSnapshotRepository(
        fixture.database,
        () => '2026-10-20T00:00:00.000Z',
      );
      const before = await snapshots.readConsistent();
      let statements = 0;
      const faulted: DatabaseHandle = {
        ...fixture.database,
        /** Injects one SQL failure inside the actual transaction, preserving SQLite rollback.
         * @param work Complete atomic replacement operation.
         * @param options Session replacement semantics retained by the fault adapter.
         * @returns Its result, or the injected failure at a specific source mutation.
         */ write: async (work, options) =>
          await fixture.database.write(
            async (sql) =>
              await work({
                ...sql,
                /** Fails exactly the selected mutation after preceding deletes/inserts ran.
                 * @param statement Trusted repository SQL.
                 * @param parameters Bound source values.
                 * @returns Completion or an injected write failure.
                 */ execute: async (statement, parameters) => {
                  statements += 1;
                  if (statements === failureAt) throw new Error('Injected write failure');
                  await sql.execute(statement, parameters);
                },
              }),
            options,
          ),
      };
      // First determine the complete number of SQL mutations without weakening fault assertions.
      if (failureAt === 1) {
        let counted = 0;
        const counter: DatabaseHandle = {
          ...fixture.database,
          /** Counts every replacement mutation and deliberately rolls back the completed operation.
           * @param work Complete replacement mutation.
           * @param options Session replacement semantics retained during rollback counting.
           * @returns Never commits this counting transaction.
           */ write: async (work, options) =>
            await fixture.database.write(async (sql) => {
              await work({
                ...sql,
                /** Counts real writes before the intentional rollback.
                 * @param statement Trusted source mutation.
                 * @param parameters Bound values.
                 * @returns Mutation completion.
                 */ execute: async (statement, parameters) => {
                  counted += 1;
                  await sql.execute(statement, parameters);
                },
              });
              throw new Error('Counting rollback');
            }, options),
        };
        await expect(
          createRestoreRepository(counter).replace({
            snapshot: snapshotFixture(),
            expectedRevision: before.revision,
            recovery: {
              profileId: 'restored-profile',
              generation: 'g',
              fingerprint: '1'.repeat(64),
              status: 'pending',
            },
          }),
        ).rejects.toThrow('Counting rollback');
        totalStatements = counted;
      }
      await expect(
        createRestoreRepository(faulted).replace({
          snapshot: snapshotFixture(),
          expectedRevision: before.revision,
          recovery: {
            profileId: 'restored-profile',
            generation: 'g',
            fingerprint: '1'.repeat(64),
            status: 'pending',
          },
        }),
      ).rejects.toThrow('Injected write failure');
      expect(await snapshots.readConsistent()).toEqual(before);
      expect((await createRecoveryMetadata(fixture.database).read()).state).toBeNull();
    } finally {
      await fixture.database.close();
    }
  }
  expect(totalStatements).toBeGreaterThan(15);
});
