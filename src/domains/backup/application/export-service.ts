import type { Result } from '@/shared/domain/result';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';
import type { SnapshotPort } from './snapshot';
import { validateSnapshot } from './validate-snapshot';
import type { BackupCodec } from './crypto-ports';
import type { BackupFilesPort } from './file-ports';
import type { RecoveryMetadataPort, RecoveryStorePort, RecoveryRecord } from './recovery-ports';
import { matchesRecovery } from './recovery-service';

/** Explicit encrypted export capability; no snapshot or secret escapes through presentation state. */
export type ExportService = { readonly exportBackup: () => Promise<Result<'saved' | 'canceled'>> };
/** Narrow dependencies for consistent reads, recovery binding and encrypted-only file writes. */
export type ExportPorts = {
  readonly snapshots: SnapshotPort;
  readonly metadata: RecoveryMetadataPort;
  readonly store: RecoveryStorePort;
  readonly fingerprint: (entropy: Uint8Array) => string;
  readonly codec: BackupCodec;
  readonly files: BackupFilesPort;
};

/** Encrypts validated source data under the exact ready recovery binding before selecting output.
 * @param ports Consistent source reads and native cryptographic/protected/file capabilities.
 * @returns Explicit export action with sanitized failure/cancellation semantics.
 */
export const createExportService = (ports: ExportPorts): ExportService => ({
  /** Creates a bounded encrypted container; missing secrets never generate a replacement.
   * @returns Saved, canceled, or a recovery/size/storage failure; active phrases remain unchanged.
   */
  exportBackup: async () => {
    let record: RecoveryRecord | null = null;
    let payload: Uint8Array | undefined;
    try {
      const metadata = await ports.metadata.read();
      if (metadata.state?.status !== 'ready')
        return {
          ok: false,
          error: {
            code: 'recovery-not-ready',
            message:
              'Finish recovery phrase setup or save the matching restored phrase before exporting.',
          },
        };
      record = await ports.store.read(metadata.state);
      if (!matchesRecovery(record, metadata, ports))
        return {
          ok: false,
          error: {
            code: 'missing-secret',
            message:
              'The matching protected secret is unavailable. Enter the existing phrase or explicitly change it for future backups.',
          },
        };
      const read = await ports.snapshots.readConsistent();
      if (read.snapshot.profile.id !== metadata.profileId || read.revision !== metadata.revision)
        return {
          ok: false,
          error: {
            code: 'stale-data',
            message: 'Data changed while preparing the backup. Try exporting again.',
          },
        };
      const validated = validateSnapshot(read.snapshot);
      if (!validated.ok) return validated;
      payload = new TextEncoder().encode(JSON.stringify(validated.value));
      if (payload.length > MAX_BACKUP_BYTES - 76)
        return {
          ok: false,
          error: {
            code: 'snapshot-limit',
            message:
              'This snapshot exceeds the supported 16 MiB backup size. No data was changed or truncated.',
          },
        };
      const encrypted = await ports.codec.sealBackup(payload, record.entropy);
      record.entropy.fill(0);
      record = null;
      payload.fill(0);
      payload = undefined;
      const current = await ports.metadata.read();
      if (
        current.profileId !== metadata.profileId ||
        JSON.stringify(current.state) !== JSON.stringify(metadata.state)
      )
        return {
          ok: false,
          error: {
            code: 'stale-recovery',
            message: 'The recovery phrase changed. Try exporting again.',
          },
        };
      return await ports.files.saveEncrypted(encrypted);
    } catch (error) {
      const limited =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'snapshot-limit';
      return {
        ok: false,
        error: {
          code: limited ? 'snapshot-limit' : 'export-failed',
          message: limited
            ? 'This dataset exceeds the supported backup record count. No records were changed or truncated.'
            : 'Unable to create an encrypted backup. Check protected storage and free space, then try again.',
        },
      };
    } finally {
      record?.entropy.fill(0);
      payload?.fill(0);
    }
  },
});
