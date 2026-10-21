import { randomUUID } from 'expo-crypto';
import type { DatabaseHandle } from '@/shared/infrastructure/database/connection';
import { createRecoveryService } from '@/domains/backup/application/recovery-service';
import { createRecoveryMetadata } from '@/domains/backup/infrastructure/recovery-metadata';
import { createSecureRecoveryStore } from '@/domains/backup/infrastructure/secure-recovery-store';
import { nativeRandom } from '@/domains/backup/infrastructure/random-source';
import {
  encodeMnemonic,
  decodeMnemonic,
  recoveryFingerprint,
} from '@/domains/backup/infrastructure/mnemonic-codec';
import { sensitiveScreen } from '@/domains/backup/infrastructure/sensitive-screen';
import { createSnapshotRepository } from '@/domains/backup/infrastructure/snapshot-repository';
import { createExportService } from '@/domains/backup/application/export-service';
import { createBackupCodec } from '@/domains/backup/infrastructure/backup-codec';
import { nativeAead } from '@/domains/backup/infrastructure/native-aes';
import { androidBackupFiles } from '@/domains/backup/infrastructure/android-backup-files';
import { createRestoreRepository } from '@/domains/backup/infrastructure/restore-repository';
import { createRestoreService } from '@/domains/backup/application/restore-service';
import type { ProfileEvents } from './profile-events';

/** Wires Android secret capabilities outside the host-testable database bootstrap.
 * @param database Lifecycle-owned app-private database; never passed to screens or Context.
 * @param profileChanges Nonsecret committed replacement notifications.
 * @returns Stateless workflow capabilities with no secret-bearing provider values.
 */
export const createNativeBackupServices = (
  database: DatabaseHandle,
  profileChanges: ProfileEvents,
) => {
  const metadata = createRecoveryMetadata(database);
  const store = createSecureRecoveryStore();
  return {
    restores: createRestoreService({
      repository: createRestoreRepository(database),
      metadata,
      store,
      codec: createBackupCodec(nativeRandom, nativeAead),
      decode: decodeMnemonic,
      fingerprint: recoveryFingerprint,
      newId: randomUUID,
      onReplaced: profileChanges.replace,
    }),
    backupFiles: androidBackupFiles,
    recovery: createRecoveryService({
      random: nativeRandom,
      store,
      metadata,
      encode: encodeMnemonic,
      decode: decodeMnemonic,
      fingerprint: recoveryFingerprint,
      newGeneration: randomUUID,
    }),
    sensitiveScreen,
    exports: createExportService({
      snapshots: createSnapshotRepository(database, () => new Date().toISOString()),
      metadata,
      store,
      fingerprint: recoveryFingerprint,
      codec: createBackupCodec(nativeRandom, nativeAead),
      files: androidBackupFiles,
    }),
  };
};
