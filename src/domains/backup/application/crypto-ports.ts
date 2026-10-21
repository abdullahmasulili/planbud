import type { Result } from '@/shared/domain/result';

/** Authenticated-encryption boundary; adapters must never return unauthenticated partial plaintext. */
export type AeadPort = {
  readonly seal: (input: {
    readonly key: Uint8Array;
    readonly nonce: Uint8Array;
    readonly aad: Uint8Array;
    readonly plaintext: Uint8Array;
  }) => Promise<{ readonly ciphertext: Uint8Array; readonly tag: Uint8Array }>;
  readonly open: (input: {
    readonly key: Uint8Array;
    readonly nonce: Uint8Array;
    readonly aad: Uint8Array;
    readonly ciphertext: Uint8Array;
    readonly tag: Uint8Array;
  }) => Promise<Uint8Array>;
};
/** Bounded versioned container processing, independent of files and financial snapshots. */
export type BackupCodec = {
  readonly sealBackup: (payload: Uint8Array, entropy: Uint8Array) => Promise<Uint8Array>;
  readonly openBackup: (container: Uint8Array, entropy: Uint8Array) => Promise<Result<Uint8Array>>;
};
