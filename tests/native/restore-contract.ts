import { randomUUID } from 'expo-crypto';
import { deleteDatabaseAsync } from 'expo-sqlite';
import { openDatabase } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';
import { createRecoveryMetadata } from '@/domains/backup/infrastructure/recovery-metadata';
import { createSecureRecoveryStore } from '@/domains/backup/infrastructure/secure-recovery-store';
import { createBackupCodec } from '@/domains/backup/infrastructure/backup-codec';
import { nativeRandom } from '@/domains/backup/infrastructure/random-source';
import { nativeAead } from '@/domains/backup/infrastructure/native-aes';
import {
  encodeMnemonic,
  decodeMnemonic,
  recoveryFingerprint,
} from '@/domains/backup/infrastructure/mnemonic-codec';
import { createRestoreService } from '@/domains/backup/application/restore-service';
import { createRecoveryService } from '@/domains/backup/application/recovery-service';
import { createSnapshotRepository } from '@/domains/backup/infrastructure/snapshot-repository';
import type { RecoveryRef } from '@/domains/backup/application/recovery-ports';
import { snapshotFixture } from '../helpers/snapshot-fixture';
import { validateSnapshot } from '@/domains/backup/application/validate-snapshot';
import type { ContractReport } from './contract-report';

/** Runs real native fresh-database restore and pending-key recovery using public vector entropy.
 * @returns Sanitized case names; all app-private test databases and secret slots are removed.
 */
export const runRestoreContract = async (): Promise<ContractReport> => {
  const name = `plan-bud-restore-${Date.now()}.db`;
  const database = await openDatabase(name);
  const store = createSecureRecoveryStore('plan-bud-restore-contract');
  const slots: RecoveryRef[] = [];
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  try {
    await migrateDatabase(database);
    const codec = createBackupCodec(nativeRandom, nativeAead);
    const metadata = createRecoveryMetadata(database);
    const snapshot = snapshotFixture();
    const canonical = validateSnapshot(snapshot);
    if (!canonical.ok) throw new Error('Invalid synthetic source fixture.');
    const service = createRestoreService({
      repository: createRestoreRepository(database),
      metadata,
      codec,
      decode: decodeMnemonic,
      fingerprint: recoveryFingerprint,
      newId: randomUUID,
      /** Leaves the product profile untouched while verifying an isolated database.
       * @returns No presentation side effect.
       */ onReplaced: () => undefined,
      store: {
        ...store,
        /** Simulates native keystore failure after the SQLite replacement commits.
         * @param record Disposable vector slot identity.
         * @returns A deliberate rejected protected write.
         */ write: async (record) => {
          slots.push({ profileId: record.profileId, generation: record.generation });
          throw new Error('Injected protected storage failure');
        },
      },
    });
    const entropy = new Uint8Array(16); // Public Trezor zero-entropy vector, never user material.
    const words = encodeMnemonic(entropy);
    const encrypted = await codec.sealBackup(
      new TextEncoder().encode(JSON.stringify(snapshot)),
      entropy,
    );
    const wrong = await service.prepareRestore(
      encrypted,
      encodeMnemonic(new Uint8Array(16).fill(127)),
    );
    if (!wrong.ok && (await database.revision()) === 0)
      passed.push('native-rejected-restore-preserves-data');
    else
      failed.push({ name: 'native-rejected-restore-preserves-data', code: 'unexpected-mutation' });
    const prepared = await service.prepareRestore(encrypted, words);
    if (!prepared.ok) throw new Error('Native restore preparation failed.');
    const result = await service.confirmRestore(prepared.value.token);
    const restored = await createSnapshotRepository(
      database,
      () => snapshot.createdAt,
    ).readConsistent();
    if (
      result.ok &&
      !result.value.recoveryReady &&
      JSON.stringify(restored.snapshot) === JSON.stringify(canonical.value) &&
      (await metadata.read()).state?.status === 'pending'
    )
      passed.push('native-restore-pending-key-atomicity');
    else
      failed.push({
        name: 'native-restore-pending-key-atomicity',
        code: 'restored-state-mismatch',
      });
    const recovery = createRecoveryService({
      metadata,
      store,
      random: nativeRandom,
      encode: encodeMnemonic,
      decode: decodeMnemonic,
      fingerprint: recoveryFingerprint,
      newGeneration: randomUUID,
    });
    const resumed = await recovery.resume(words);
    const status = await recovery.status();
    if (resumed.ok && status.ok && status.value === 'ready')
      passed.push('native-resume-matching-restored-phrase');
    else
      failed.push({ name: 'native-resume-matching-restored-phrase', code: 'recovery-not-ready' });
    entropy.fill(0);
  } catch {
    failed.push({ name: 'native-restore', code: 'native-operation-failed' });
  } finally {
    try {
      for (const ref of slots) await store.remove(ref);
      await database.close();
      await deleteDatabaseAsync(name);
    } catch {
      failed.push({ name: 'native-restore-cleanup', code: 'cleanup-failed' });
    }
  }
  return { passed, failed };
};
