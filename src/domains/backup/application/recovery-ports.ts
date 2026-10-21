import type { Result } from '@/shared/domain/result';

/** Synchronous native CSPRNG capability; failure must never fall back to a PRNG. */
export type RandomPort = { readonly bytes: (length: number) => Uint8Array };
/** Portable nonsecret generation identity. */
export type RecoveryRef = { readonly profileId: string; readonly generation: string };
/** Secret material owned only by short-lived workflows and protected-storage adapters. */
export type RecoveryRecord = RecoveryRef & { readonly entropy: Uint8Array };
/** Generation-specific protected slots, independent of the financial database and exported files. */
export type RecoveryStorePort = {
  readonly read: (ref: RecoveryRef) => Promise<RecoveryRecord | null>;
  readonly write: (record: RecoveryRecord) => Promise<void>;
  readonly remove: (ref: RecoveryRef) => Promise<void>;
};
/** Local nonsecret recovery binding; excluded from portable snapshots. */
export type LocalRecoveryState = RecoveryRef & {
  readonly fingerprint: string;
  readonly status: 'pending' | 'ready';
};
/** Profile/revision read atomically with its active recovery binding. */
export type RecoveryMetadata = {
  readonly profileId: string;
  readonly revision: number;
  readonly state: LocalRecoveryState | null;
};
/** Atomic active-reference update after a new secure slot has been saved. */
export type RecoveryMetadataPort = {
  readonly read: () => Promise<RecoveryMetadata>;
  readonly activate: (input: {
    readonly expectedRevision: number;
    readonly state: LocalRecoveryState;
  }) => Promise<void>;
};
/** Injected secret capabilities; no framework, database, or cryptographic adapter dependencies. */
export type RecoveryPorts = {
  readonly random: RandomPort;
  readonly store: RecoveryStorePort;
  readonly metadata: RecoveryMetadataPort;
  readonly encode: (entropy: Uint8Array) => string;
  readonly decode: (words: string) => Result<Uint8Array>;
  readonly fingerprint: (entropy: Uint8Array) => string;
  readonly newGeneration: () => string;
};
