import type { Result } from '@/shared/domain/result';
import type { RecoveryPorts, RecoveryMetadata, RecoveryRecord } from './recovery-ports';

/** Nonsecret backup readiness; missing local keys never trigger automatic generation. */
export type RecoveryStatus = 'unconfigured' | 'ready' | 'pending' | 'missing-secret';
/** Deliberate short-lived reveal; references disappear when disposed or backgrounded. */
export type RecoveryReveal = { readonly words: () => string; readonly dispose: () => void };
/** Generated phrase session, persisted only after all selected words and acknowledgment match. */
export type RecoverySession = RecoveryReveal & {
  readonly positions: readonly number[];
  readonly confirm: (
    answers: readonly { readonly position: number; readonly word: string }[],
    acknowledged: boolean,
  ) => Promise<Result<void>>;
};
/** Public secret workflows expose capabilities, never long-lived secret values. */
export type RecoveryService = {
  readonly status: () => Promise<Result<RecoveryStatus>>;
  readonly create: (replace: boolean) => Promise<Result<RecoverySession>>;
  readonly reveal: () => Promise<Result<RecoveryReveal>>;
  readonly resume: (words: string) => Promise<Result<void>>;
};

/** Builds a sanitized failure without including native messages or secret input.
 * @param code Stable workflow failure identity.
 * @param message Actionable user-facing text.
 * @returns Failed typed result.
 */
const failure = (code: string, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});

/** Samples three distinct positions uniformly using bounded Fisher-Yates and rejection sampling.
 * @param ports Native randomness; deterministic values are supplied only by vector tests.
 * @returns Three one-based word positions, sorted for the confirmation form.
 * @throws When randomness fails or repeatedly returns out-of-range samples.
 */
const confirmationPositions = (ports: RecoveryPorts): readonly number[] => {
  const remaining = Array.from({ length: 12 }, (_, index) => index + 1);
  const selected: number[] = [];
  for (let pick = 0; pick < 3; pick += 1) {
    const bound = remaining.length;
    const ceiling = Math.floor(256 / bound) * bound;
    let value: number | undefined;
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const sample = ports.random.bytes(1);
      if (sample.length !== 1) throw new Error('Invalid native randomness.');
      const byte = sample[0];
      if (byte !== undefined && byte < ceiling) {
        value = byte % bound;
        break;
      }
    }
    if (value === undefined) throw new Error('Native randomness unavailable.');
    const position = remaining.splice(value, 1)[0];
    if (position === undefined) throw new Error('Invalid confirmation selection.');
    selected.push(position);
  }
  return selected.sort((a, b) => a - b);
};

/** Checks profile/generation/fingerprint together before allowing reveal or export.
 * @param record Protected local record or missing slot.
 * @param metadata Current atomic profile binding.
 * @param ports Maintained fingerprint capability.
 * @returns Whether the exact active secret is present.
 */
export const matchesRecovery = (
  record: RecoveryRecord | null,
  metadata: RecoveryMetadata,
  ports: Pick<RecoveryPorts, 'fingerprint'>,
): record is RecoveryRecord =>
  record !== null &&
  metadata.state !== null &&
  record.profileId === metadata.profileId &&
  record.profileId === metadata.state.profileId &&
  record.generation === metadata.state.generation &&
  record.entropy.length === 16 &&
  ports.fingerprint(record.entropy) === metadata.state.fingerprint;

/** Owns private phrase sessions and saves a new protected slot before activating its reference.
 * @param ports Native/protected capabilities wired only by composition.
 * @returns Readiness, deliberate generation and deliberate reveal workflows.
 */
export const createRecoveryService = (ports: RecoveryPorts): RecoveryService => ({
  /** Reattaches only the exact phrase bound to restored or missing local recovery metadata.
   * @param words All twelve original English words entered on a protected screen.
   * @returns Completion; another valid phrase cannot replace or enable the current binding.
   */
  resume: async (words) => {
    const decoded = ports.decode(words);
    if (!decoded.ok) return decoded;
    try {
      const metadata = await ports.metadata.read();
      const state = metadata.state;
      if (!state || ports.fingerprint(decoded.value) !== state.fingerprint)
        return failure(
          'phrase-mismatch',
          'This phrase does not match the recovery key bound to the current data. Use the original phrase.',
        );
      await ports.store.write({
        profileId: metadata.profileId,
        generation: state.generation,
        entropy: decoded.value,
      });
      const current = await ports.metadata.read();
      if (
        current.profileId !== metadata.profileId ||
        JSON.stringify(current.state) !== JSON.stringify(state)
      )
        return failure(
          'stale-recovery',
          'Recovery settings changed. Reopen this screen and try again.',
        );
      await ports.metadata.activate({
        expectedRevision: current.revision,
        state: { ...state, status: 'ready' },
      });
      return { ok: true, value: undefined };
    } catch {
      return failure(
        'recovery-save-failed',
        'Unable to save the matching phrase in protected storage. Your financial data is unchanged; try again.',
      );
    } finally {
      decoded.value.fill(0);
    }
  },
  /** Resolves readiness without generating a replacement for missing or failed storage.
   * @returns Nonsecret readiness or an actionable protected-storage failure.
   */
  status: async () => {
    try {
      const metadata = await ports.metadata.read();
      if (!metadata.state) return { ok: true, value: 'unconfigured' };
      const record = await ports.store.read(metadata.state);
      try {
        return {
          ok: true,
          value: matchesRecovery(record, metadata, ports)
            ? metadata.state.status === 'ready'
              ? 'ready'
              : 'pending'
            : 'missing-secret',
        };
      } finally {
        record?.entropy.fill(0);
      }
    } catch {
      return failure(
        'recovery-unavailable',
        'Protected recovery storage is unavailable. Try again; no new phrase has been created.',
      );
    }
  },
  /** Starts explicit setup or replacement; saves nothing until the confirmation gate succeeds.
   * @param replace Explicit permission to replace an existing binding for future backups.
   * @returns A short-lived phrase session, or a generation/storage failure.
   */
  create: async (replace) => {
    let entropy: Uint8Array | undefined;
    try {
      const original = await ports.metadata.read();
      if (original.state && !replace)
        return failure(
          'replacement-required',
          'A recovery phrase is already configured. Choose Change phrase explicitly.',
        );
      entropy = ports.random.bytes(16);
      if (entropy.length !== 16) throw new Error('Invalid native randomness.');
      const secret = entropy;
      let phrase = ports.encode(secret);
      const positions = confirmationPositions(ports);
      const generation = ports.newGeneration();
      let disposed = false;
      let busy = false;
      let activated = false;
      const session: RecoverySession = {
        positions,
        /** Derives visible words only while the sensitive view owns this session.
         * @returns Phrase text or an empty value after disposal.
         */
        words: () => (disposed ? '' : phrase),
        /** Drops phrase references and overwrites the mutable entropy copy on teardown. */
        dispose: () => {
          disposed = true;
          phrase = '';
          if (!busy) secret.fill(0);
        },
        /** Confirms all positions, writes the new slot, then atomically activates its binding.
         * @param answers Exactly the three requested one-based positions and their words.
         * @param acknowledged Whether the user acknowledged that both file and phrase are required.
         * @returns Completion or an actionable failure; previous active keys survive failed activation.
         */
        confirm: async (answers, acknowledged) => {
          if (disposed || busy)
            return failure('closed-recovery-session', 'Reopen recovery setup before continuing.');
          const words = phrase.split(' ');
          if (
            !acknowledged ||
            answers.length !== 3 ||
            new Set(answers.map((answer) => answer.position)).size !== 3 ||
            positions.some(
              (position) =>
                !answers.some(
                  (answer) =>
                    answer.position === position &&
                    answer.word.trim().toLowerCase() === words[position - 1],
                ),
            )
          )
            return failure(
              'confirmation-mismatch',
              'Confirm each requested word and acknowledge that both the backup file and phrase are required.',
            );
          busy = true;
          const record: RecoveryRecord = {
            profileId: original.profileId,
            generation,
            entropy: secret,
          };
          try {
            if (!activated) {
              const current = await ports.metadata.read();
              if (
                current.profileId !== original.profileId ||
                JSON.stringify(current.state) !== JSON.stringify(original.state)
              )
                return failure(
                  'stale-recovery',
                  'Recovery settings changed. Close this screen and start again.',
                );
              if (disposed)
                return failure(
                  'closed-recovery-session',
                  'Reopen recovery setup before continuing.',
                );
              await ports.store.write(record);
              if (disposed) {
                await ports.store.remove(record);
                return failure(
                  'closed-recovery-session',
                  'Reopen recovery setup before continuing.',
                );
              }
              try {
                await ports.metadata.activate({
                  expectedRevision: current.revision,
                  state: {
                    profileId: original.profileId,
                    generation,
                    fingerprint: ports.fingerprint(secret),
                    status: 'ready',
                  },
                });
                activated = true;
              } catch (error) {
                try {
                  await ports.store.remove(record);
                } catch (cleanupError) {
                  throw new AggregateError(
                    [error, cleanupError],
                    'Recovery activation and cleanup failed.',
                  );
                }
                throw error;
              }
            }
            if (original.state) await ports.store.remove(original.state);
            return { ok: true, value: undefined };
          } catch {
            return failure(
              'recovery-save-failed',
              activated
                ? 'New phrase saved, but the previous local key could not be removed. Retry to finish cleanup.'
                : 'Unable to save the recovery phrase. Your previous phrase remains active. Try again.',
            );
          } finally {
            busy = false;
            if (disposed) secret.fill(0);
          }
        },
      };
      return { ok: true, value: session };
    } catch {
      entropy?.fill(0);
      return failure(
        'recovery-unavailable',
        'Unable to prepare recovery securely. Try again; no new phrase has been saved.',
      );
    }
  },
  /** Reveals only the protected secret matching the active profile and generation.
   * @returns Disposable reveal session or a missing/storage failure; never silently replaces a key.
   */
  reveal: async () => {
    let record: RecoveryRecord | null = null;
    try {
      const metadata = await ports.metadata.read();
      if (!metadata.state)
        return failure('recovery-unconfigured', 'Set up a recovery phrase before revealing it.');
      record = await ports.store.read(metadata.state);
      if (!matchesRecovery(record, metadata, ports))
        return failure(
          'missing-secret',
          'The matching local secret is unavailable. Enter your existing phrase or explicitly change it for future backups.',
        );
      let phrase = ports.encode(record.entropy);
      return {
        ok: true,
        value: {
          /** Returns the deliberately revealed phrase while owned by its view.
           * @returns Phrase text or an empty value after disposal.
           */ words: () => phrase,
          /** Removes the transient phrase reference on close or background. */ dispose: () => {
            phrase = '';
          },
        },
      };
    } catch {
      return failure(
        'recovery-unavailable',
        'Unable to access protected recovery storage. Try again.',
      );
    } finally {
      record?.entropy.fill(0);
    }
  },
});
