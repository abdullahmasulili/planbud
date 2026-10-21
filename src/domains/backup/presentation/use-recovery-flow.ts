import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { RecoveryService, RecoveryReveal, RecoverySession } from '../application/public';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { useOperation } from '@/shared/presentation/use-operation';
import { useSensitiveView } from './use-sensitive-view';

/** Keeps phrase references local and short lived, protected before generation or reveal.
 * @param service Secret-session use cases; contains no phrase state in Context.
 * @param protection Native capture/recents protection with keyed cleanup.
 * @returns Deliberate actions and local transient reveal/confirmation view state.
 */
export const useRecoveryFlow = (service: RecoveryService, protection: SensitiveScreenPort) => {
  const [words, setWords] = useState<readonly string[]>([]);
  const [positions, setPositions] = useState<readonly number[]>([]);
  const [phase, setPhase] = useState<'intro' | 'reveal' | 'confirm' | 'resume' | 'done'>('intro');
  const session = useRef<RecoveryReveal | RecoverySession | null>(null);
  const epoch = useRef(0);
  const operation = useOperation();
  /** Clears transient secrets immediately on blur/background; JS memory erasure is not guaranteed. */
  const dispose = useCallback(() => {
    epoch.current += 1;
    session.current?.dispose();
    session.current = null;
    setWords([]);
    setPositions([]);
    setPhase('intro');
  }, []);
  const protectionState = useSensitiveView(protection, dispose);
  const protectedView = protectionState.ready;
  /** Starts explicit setup/replacement after protection is confirmed.
   * @param replace Explicit replacement of the active phrase for future exports.
   */
  const create = (replace: boolean) => {
    if (!protectedView || operation.busy) return;
    dispose();
    const owner = epoch.current;
    operation.run(
      async () => {
        const result = await service.create(replace);
        if (owner !== epoch.current || AppState.currentState === 'background') {
          if (result.ok) result.value.dispose();
          return {
            ok: false,
            error: { code: 'closed-session', message: 'Reopen recovery setup to continue.' },
          };
        }
        return result;
      },
      (value) => {
        session.current = value;
        setWords(value.words().split(' '));
        setPositions(value.positions);
        setPhase('reveal');
      },
    );
  };
  /** Reveals only the locally protected secret matching the active generation. */
  const reveal = () => {
    if (!protectedView || operation.busy) return;
    dispose();
    const owner = epoch.current;
    operation.run(
      async () => {
        const result = await service.reveal();
        if (owner !== epoch.current) {
          if (result.ok) result.value.dispose();
          return {
            ok: false,
            error: { code: 'closed-session', message: 'Reveal the phrase again to continue.' },
          };
        }
        return result;
      },
      (value) => {
        session.current = value;
        setWords(value.words().split(' '));
        setPhase('reveal');
      },
    );
  };
  /** Hides the phrase before showing the three-word confirmation form. */
  const startConfirmation = () => {
    setWords([]);
    setPhase('confirm');
  };
  /** Persists a generated secret only after the complete confirmation gate.
   * @param answers Three one-based word positions and user-entered answers.
   * @param acknowledged Whether both-file-and-phrase recovery was acknowledged.
   */
  const confirm = (
    answers: readonly { position: number; word: string }[],
    acknowledged: boolean,
  ) => {
    const current = session.current;
    if (!current || !('confirm' in current)) return;
    operation.run(
      async () => await current.confirm(answers, acknowledged),
      () => {
        dispose();
        setPhase('done');
      },
    );
  };
  /** Opens transient input for the phrase already bound to the current data. */
  const startResume = () => {
    dispose();
    setPhase('resume');
  };
  /** Saves only the existing matching phrase; a different valid phrase is refused.
   * @param value Original twelve-word recovery phrase from protected local input.
   */
  const resume = (value: string) => {
    if (!protectedView || operation.busy) return;
    operation.run(
      async () => await service.resume(value),
      () => {
        dispose();
        setPhase('done');
      },
    );
  };
  return {
    startResume,
    resume,
    protectedView,
    words,
    positions,
    phase,
    message: protectionState.message || operation.message,
    busy: operation.busy,
    create,
    reveal,
    startConfirmation,
    confirm,
    dispose,
  };
};
