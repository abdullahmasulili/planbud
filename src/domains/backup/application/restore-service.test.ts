import { randomBytes } from 'node:crypto';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { snapshotFixture } from '../../../../tests/helpers/snapshot-fixture';
import { hostAead } from '../../../../tests/helpers/host-aead';
import { createBackupCodec } from '../infrastructure/backup-codec';
import { createRestoreRepository } from '../infrastructure/restore-repository';
import { createRecoveryMetadata } from '../infrastructure/recovery-metadata';
import { createSnapshotRepository } from '../infrastructure/snapshot-repository';
import {
  encodeMnemonic,
  decodeMnemonic,
  recoveryFingerprint,
} from '../infrastructure/mnemonic-codec';
import { createRecoveryService } from './recovery-service';
import { createRestoreService } from './restore-service';
import type { RecoveryRecord, RecoveryStorePort } from './recovery-ports';

/** Composes real SQLite and independent host encryption with a labeled public BIP-39 vector.
 * @returns Isolated restore controls and native-port failure simulations.
 */
const setup = async () => {
  const fixture = await createTransactionFixture();
  const records = new Map<string, RecoveryRecord>();
  let failStore = false;
  let failMark = false;
  let ids = 0;
  const store: RecoveryStorePort = {
    /** Reads an owned copy so callers may dispose their entropy buffers.
     * @param ref Requested nonsecret slot reference.
     * @returns Stored vector data or absence.
     */ read: async (ref) => {
      const value = records.get(ref.generation);
      return value ? { ...value, entropy: value.entropy.slice() } : null;
    },
    /** Simulates protected storage success or failure.
     * @param record Labeled vector record.
     * @returns Completion or native-port failure.
     */ write: async (record) => {
      if (failStore) throw new Error('unavailable');
      records.set(record.generation, { ...record, entropy: record.entropy.slice() });
    },
    /** Removes an app-owned test slot.
     * @param ref Nonsecret generation identity.
     * @returns Completion.
     */ remove: async (ref) => {
      records.delete(ref.generation);
    },
  };
  const metadata = createRecoveryMetadata(fixture.database);
  const repository = createRestoreRepository(fixture.database);
  const codec = createBackupCodec({ bytes: randomBytes }, hostAead);
  const onReplaced = jest.fn();
  const service = createRestoreService({
    repository: {
      ...repository,
      /** Simulates process death after the protected write but before readiness.
       * @param ref Adopted nonsecret slot.
       * @returns Completion or injected readiness failure.
       */ markRecoveryReady: async (ref) => {
        if (failMark) throw new Error('interrupted');
        await repository.markRecoveryReady(ref);
      },
    },
    metadata,
    store,
    codec,
    decode: decodeMnemonic,
    fingerprint: recoveryFingerprint,
    /** Supplies deterministic review identities without generating recovery entropy.
     * @returns Unique test review/generation identity.
     */ newId: () => `restore-${++ids}`,
    onReplaced,
  });
  const recovery = createRecoveryService({
    metadata,
    store,
    random: { bytes: randomBytes },
    encode: encodeMnemonic,
    decode: decodeMnemonic,
    fingerprint: recoveryFingerprint,
    /** Supplies deterministic unused generation identities.
     * @returns Unique test identity.
     */ newGeneration: () => `generation-${++ids}`,
  });
  // Public Trezor zero-entropy vector; never generated recovery material.
  const entropy = new Uint8Array(16);
  const words = encodeMnemonic(entropy);
  const bytes = await codec.sealBackup(
    new TextEncoder().encode(JSON.stringify(snapshotFixture())),
    entropy,
  );
  return {
    ...fixture,
    service,
    recovery,
    codec,
    bytes,
    words,
    records,
    onReplaced,
    /** Controls the protected-write failure stage.
     * @param fail Whether to reject adoption.
     */ setStoreFailure: (fail: boolean) => {
      failStore = fail;
    },
    /** Controls the final metadata readiness stage.
     * @param fail Whether to simulate interrupted readiness.
     */ setMarkFailure: (fail: boolean) => {
      failMark = fail;
    },
  };
};

it('RESTORE-001 previews counts only, then explicitly replaces data once using the entered phrase', async () => {
  const test = await setup();
  try {
    const before = await test.database.revision();
    const prepared = await test.service.prepareRestore(test.bytes, test.words);
    if (!prepared.ok) throw new Error('Synthetic backup failed');
    expect(prepared.value).toMatchObject({
      sourceRevision: before,
      createdAt: snapshotFixture().createdAt,
      counts: { goals: 1, transactions: 2, contributions: 1 },
    });
    expect(Object.keys(prepared.value).sort()).toEqual(
      ['token', 'sourceRevision', 'createdAt', 'counts'].sort(),
    );
    expect(await test.database.revision()).toBe(before);
    expect(await test.service.confirmRestore(prepared.value.token)).toEqual({
      ok: true,
      value: { recoveryReady: true },
    });
    expect(await test.service.confirmRestore(prepared.value.token)).toMatchObject({ ok: false });
    expect(
      (
        await createSnapshotRepository(
          test.database,
          () => snapshotFixture().createdAt,
        ).readConsistent()
      ).snapshot,
    ).toEqual(snapshotFixture());
    expect(test.onReplaced).toHaveBeenCalledWith(snapshotFixture().profile);
    expect(await test.recovery.status()).toEqual({ ok: true, value: 'ready' });
  } finally {
    await test.database.close();
  }
});

it('RESTORE-002 rejects every invalid preparation, cancellation and stale revision without touching current data', async () => {
  const test = await setup();
  try {
    const before = await test.database.revision();
    expect(await test.service.prepareRestore(test.bytes, 'invalid words')).toMatchObject({
      ok: false,
    });
    const wrong = encodeMnemonic(new Uint8Array(16).fill(127)); // Published Trezor 7f entropy vector.
    expect(await test.service.prepareRestore(test.bytes, wrong)).toMatchObject({
      ok: false,
      error: { code: 'backup-authentication-failed' },
    });
    for (const payload of [
      new TextEncoder().encode('{'),
      new TextEncoder().encode(JSON.stringify({ ...snapshotFixture(), schemaVersion: 2 })),
      new TextEncoder().encode(JSON.stringify({ ...snapshotFixture(), device: {} })),
    ]) {
      const encrypted = await test.codec.sealBackup(payload, new Uint8Array(16));
      expect(await test.service.prepareRestore(encrypted, test.words)).toMatchObject({ ok: false });
    }
    const text = JSON.stringify({
      ...snapshotFixture(),
      goals: [{ ...snapshotFixture().goals[0], name: '�' }],
    });
    const utf8 = new TextEncoder().encode(text);
    const start = utf8.findIndex((byte) => byte === 239);
    const invalidUtf8 = Uint8Array.from([...utf8.slice(0, start), 255, ...utf8.slice(start + 3)]);
    expect(
      await test.service.prepareRestore(
        await test.codec.sealBackup(invalidUtf8, new Uint8Array(16)),
        test.words,
      ),
    ).toMatchObject({ ok: false });
    const canceled = await test.service.prepareRestore(test.bytes, test.words);
    if (!canceled.ok) throw new Error('Preparation failed');
    test.service.cancelRestore(canceled.value.token);
    expect(await test.service.confirmRestore(canceled.value.token)).toMatchObject({ ok: false });
    expect(await test.database.revision()).toBe(before);
    const stale = await test.service.prepareRestore(test.bytes, test.words);
    if (!stale.ok) throw new Error('Preparation failed');
    await test.budgets.saveCategory({
      id: 'another',
      name: 'Another',
      kind: 'flexible',
      archived: false,
    });
    expect(await test.service.confirmRestore(stale.value.token)).toMatchObject({
      ok: false,
      error: { code: 'stale-data' },
    });
    expect((await createRecoveryMetadata(test.database).read()).profileId).toBe(test.profile.id);
  } finally {
    await test.database.close();
  }
});

it('RESTORE-003 keeps committed data on secret failure and resumes only with the matching phrase after restart', async () => {
  for (const stage of ['protected-write', 'readiness-write']) {
    const test = await setup();
    try {
      test.setStoreFailure(stage === 'protected-write');
      test.setMarkFailure(stage === 'readiness-write');
      const preview = await test.service.prepareRestore(test.bytes, test.words);
      if (!preview.ok) throw new Error('Preparation failed');
      expect(await test.service.confirmRestore(preview.value.token)).toEqual({
        ok: true,
        value: { recoveryReady: false },
      });
      const metadata = await createRecoveryMetadata(test.database).read();
      expect(metadata).toMatchObject({
        profileId: 'restored-profile',
        state: { status: 'pending' },
      });
      expect(await test.recovery.status()).toMatchObject({
        ok: true,
        value: stage === 'protected-write' ? 'missing-secret' : 'pending',
      });
      const wrong = encodeMnemonic(new Uint8Array(16).fill(127));
      expect(await test.recovery.resume(wrong)).toMatchObject({ ok: false });
      expect((await createRecoveryMetadata(test.database).read()).state?.status).toBe('pending');
      test.setStoreFailure(false);
      test.setMarkFailure(false);
      expect(await test.recovery.resume(test.words)).toMatchObject({ ok: true });
      expect(await test.recovery.status()).toMatchObject({ ok: true, value: 'ready' });
      expect(
        (
          await createSnapshotRepository(
            test.database,
            () => snapshotFixture().createdAt,
          ).readConsistent()
        ).snapshot,
      ).toEqual(snapshotFixture());
    } finally {
      await test.database.close();
    }
  }
});

it('RESTORE-001 clears local data only after explicit confirmation, without a file-deletion capability', async () => {
  const test = await setup();
  try {
    const before = await test.database.revision();
    expect(await test.service.resetProfile(false)).toMatchObject({ ok: false });
    expect(await test.database.revision()).toBe(before);
    expect(await test.service.resetProfile(true)).toMatchObject({ ok: true });
    expect(test.onReplaced).toHaveBeenCalledWith(null);
    expect(
      await test.database.read(async (sql) => await sql.all('SELECT id FROM profiles')),
    ).toEqual([]);
  } finally {
    await test.database.close();
  }
});
