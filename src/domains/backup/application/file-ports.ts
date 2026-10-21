import type { Result } from '@/shared/domain/result';

/** Encrypted-only Android file boundary; provider references never escape this capability. */
export type BackupFilesPort = {
  readonly saveEncrypted: (bytes: Uint8Array) => Promise<Result<'saved' | 'canceled'>>;
  readonly pickEncrypted: () => Promise<Result<Uint8Array | null>>;
};
