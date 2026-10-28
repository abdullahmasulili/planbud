import type { Snapshot } from './snapshot';
import type {
  LocalRecoveryState,
  RecoveryRef,
  RecoveryRecord,
  RecoveryMetadataPort,
  RecoveryStorePort,
} from './recovery-ports';
import type { Profile } from '@/domains/settings/application/public';
import type { BackupCodec } from './crypto-ports';
import type { Result } from '@/shared/domain/result';
import { validateSnapshot } from './validate-snapshot';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';

/** Atomic destructive source capability; secret storage remains a separate protected operation. */
export type RestorePort = {
  readonly revision: () => Promise<number>;
  readonly replace: (input: {
    readonly snapshot: Snapshot;
    readonly expectedRevision: number;
    readonly recovery: LocalRecoveryState;
  }) => Promise<void>;
  readonly markRecoveryReady: (ref: RecoveryRef) => Promise<void>;
  readonly reset: (expectedRevision: number) => Promise<void>;
};

/** Nonsecret review handle; never contains plaintext records, phrase, or provider references. */
export type RestorePreview = {
  readonly token: string;
  readonly sourceRevision: number;
  readonly createdAt: string;
  readonly counts: Readonly<Record<string, number>>;
};
/** Private workflow dependencies; replacement notification contains confirmed profile metadata only. */
export type RestorePorts = {
  readonly repository: RestorePort;
  readonly metadata: RecoveryMetadataPort;
  readonly store: RecoveryStorePort;
  readonly codec: BackupCodec;
  readonly decode: (words: string) => Result<Uint8Array>;
  readonly fingerprint: (entropy: Uint8Array) => string;
  readonly newId: () => string;
  readonly onReplaced: (profile: Profile | null) => void;
};
/** Explicit prepare/confirm/cancel/reset actions; secret sessions remain inside the service closure. */
export type RestoreService = {
  readonly prepareRestore: (bytes: Uint8Array, words: string) => Promise<Result<RestorePreview>>;
  readonly confirmRestore: (token: string) => Promise<Result<{ readonly recoveryReady: boolean }>>;
  readonly cancelRestore: (token: string) => void;
  readonly resetProfile: (
    confirmed: boolean,
  ) => Promise<Result<{ readonly secretCleanupPending: boolean }>>;
};
/** Service-private source/entropy ownership; never exposed through Context or Zustand. */
type RestoreSession = {
  readonly token: string;
  readonly snapshot: Snapshot;
  readonly sourceRevision: number;
  readonly recovery: LocalRecoveryState;
  readonly entropy: Uint8Array;
};

/** Translates pre-commit failures without suggesting a failed protected write undid a restore.
 * @param error Unknown adapter or decode rejection.
 * @returns Actionable stale-data or preparation/transaction failure.
 */
const restoreFailure = (error: unknown): Result<never> => {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'stale-data')
    return {
      ok: false,
      error: {
        code: 'stale-data',
        message:
          'Local data changed after the preview. Select the file and review it again before replacing data.',
      },
    };
  return {
    ok: false,
    error: {
      code: 'restore-failed',
      message:
        'Unable to validate or replace data. Current records were not replaced. Choose the backup and enter its phrase again.',
    },
  };
};

/** Authenticates and validates private restore sessions, then adopts the exact restored key.
 * @param ports Atomic source replacement and separate native secret capabilities.
 * @returns Explicit destructive workflows with cancellation and crash-safe pending recovery.
 */
export const createRestoreService = (ports: RestorePorts): RestoreService => {
  let session: RestoreSession | null = null;
  let generation = 0;
  let committing = false;
  /** Disposes only prepared session references; an explicitly confirmed transaction owns its copy. */
  const dispose = () => {
    generation += 1;
    session?.entropy.fill(0);
    session = null;
  };
  return {
    /** Decrypts in memory, validates exact UTF-8/JSON/schema and returns counts only.
     * @param bytes Complete bounded ciphertext selected by the encrypted-only file adapter.
     * @param words All twelve English recovery words from protected local input.
     * @returns Nonsecret review handle or a failure; current records remain untouched.
     */
    prepareRestore: async (bytes, words) => {
      if (committing)
        return {
          ok: false,
          error: { code: 'restore-busy', message: 'Wait for the current replacement to finish.' },
        };
      dispose();
      const owner = generation;
      const decoded = ports.decode(words);
      if (!decoded.ok) return decoded;
      let plaintext: Uint8Array | undefined;
      let retained = false;
      try {
        if (bytes.length > MAX_BACKUP_BYTES) return restoreFailure(null);
        const revision = await ports.repository.revision();
        const opened = await ports.codec.openBackup(bytes, decoded.value);
        if (!opened.ok) return opened;
        plaintext = opened.value;
        const text = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
        // Check canonical UTF-8 too: runtimes must not silently replace malformed byte sequences.
        const reencoded = new TextEncoder().encode(text);
        if (
          reencoded.length !== plaintext.length ||
          reencoded.some((byte, index) => byte !== plaintext?.[index])
        )
          return restoreFailure(null);
        const value: unknown = JSON.parse(text);
        const parsed = validateSnapshot(value);
        if (!parsed.ok) return parsed;
        if (owner !== generation)
          return {
            ok: false,
            error: {
              code: 'restore-canceled',
              message:
                'Restore preparation was canceled. Select the file and enter its phrase again.',
            },
          };
        const snapshot = parsed.value;
        const token = ports.newId();
        session = {
          token,
          snapshot,
          sourceRevision: revision,
          entropy: decoded.value,
          recovery: {
            profileId: snapshot.profile.id,
            generation: ports.newId(),
            fingerprint: ports.fingerprint(decoded.value),
            status: 'pending',
          },
        };
        retained = true;
        return {
          ok: true,
          value: {
            token,
            sourceRevision: revision,
            createdAt: snapshot.createdAt,
            counts: {
              categories: snapshot.categories.length,
              plans: snapshot.plans.length,
              transactions: snapshot.transactions.length,
              goals: snapshot.goals.length,
              contributions: snapshot.contributions.length,
              allocations: snapshot.allocations.length,
              ...(snapshot.schemaVersion === 2
                ? {
                    namedPlans: snapshot.namedPlans.length,
                    expenseEstimates: snapshot.namedPlans.reduce(
                      (count, plan) => count + plan.items.length,
                      0,
                    ),
                  }
                : {}),
            },
          },
        };
      } catch (error) {
        return restoreFailure(error);
      } finally {
        plaintext?.fill(0);
        if (!retained) decoded.value.fill(0);
      }
    },
    /** Replaces once at the reviewed revision; a later secret failure keeps restored data pending.
     * @param token Current nonsecret preview capability.
     * @returns Committed replacement readiness or a pre-commit validation/transaction failure.
     */
    confirmRestore: async (token) => {
      const current = session;
      if (!current || current.token !== token || committing)
        return {
          ok: false,
          error: {
            code: 'stale-restore',
            message:
              'This preview is no longer active. Select the file and enter its phrase again.',
          },
        };
      committing = true;
      session = null;
      generation += 1;
      let replaced = false;
      try {
        await ports.repository.replace({
          snapshot: current.snapshot,
          expectedRevision: current.sourceRevision,
          recovery: current.recovery,
        });
        replaced = true;
        ports.onReplaced(current.snapshot.profile);
        const record: RecoveryRecord = {
          profileId: current.recovery.profileId,
          generation: current.recovery.generation,
          entropy: current.entropy,
        };
        await ports.store.write(record);
        await ports.repository.markRecoveryReady(record);
        return { ok: true, value: { recoveryReady: true } };
      } catch (error) {
        if (replaced) return { ok: true, value: { recoveryReady: false } };
        return restoreFailure(error);
      } finally {
        current.entropy.fill(0);
        committing = false;
      }
    },
    /** Invalidates one prepared review, or all preparation when backgrounding supplies an empty token.
     * @param token Current preview identity, or empty text to dispose all unconfirmed preparation.
     */
    cancelRestore: (token) => {
      if (token === '' || session?.token === token) dispose();
    },
    /** Clears only app-private source data after an explicit irreversible confirmation.
     * @param confirmed Whether the user deliberately confirmed replacement with an empty profile.
     * @returns Durable clear completion and a truthful protected-key cleanup warning if needed.
     */
    resetProfile: async (confirmed) => {
      if (!confirmed || committing)
        return {
          ok: false,
          error: {
            code: 'clear-confirmation-required',
            message: 'Confirm clearing local data before continuing.',
          },
        };
      dispose();
      committing = true;
      let cleared = false;
      try {
        const metadata = await ports.metadata.read();
        await ports.repository.reset(metadata.revision);
        cleared = true;
        ports.onReplaced(null);
        if (metadata.state) await ports.store.remove(metadata.state);
        return { ok: true, value: { secretCleanupPending: false } };
      } catch (error) {
        if (cleared) return { ok: true, value: { secretCleanupPending: true } };
        return restoreFailure(error);
      } finally {
        committing = false;
      }
    },
  };
};
