import { useEffect } from 'react';
import type { EffectCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { act, renderHook } from '@testing-library/react-native';
import { useRecoveryFlow } from './use-recovery-flow';
import type { RecoveryService } from '../application/public';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

/** Supplies focus lifetime for an isolated hook without a router/native screen tree.
 * @param effect Native-screen focus synchronization under test.
 * @returns The effect registration result.
 */
const useTestFocus = (effect: EffectCallback) => useEffect(effect, [effect]);

it('KEY-005 blocks reveal before capture protection and disposes secret state on background', async () => {
  jest.mocked(useFocusEffect).mockImplementation(useTestFocus);
  let unlock: ((value: string) => void) | undefined;
  let phrase = 'PUBLIC VECTOR PLACEHOLDER';
  const reveal = jest.fn(
    async () =>
      ({
        ok: true,
        value: {
          /** Returns labeled nonsecret test text while owned by the view.
           * @returns Test text, never real recovery material.
           */ words: () => phrase,
          /** Simulates disposable reveal references. */ dispose: () => {
            phrase = '';
          },
        },
      }) satisfies Awaited<ReturnType<RecoveryService['reveal']>>,
  );
  const service: RecoveryService = {
    /** Completes an unused matching-secret action.
     * @returns Successful completion.
     */ resume: async () => ({ ok: true, value: undefined }),
    /** Reports a matching local key.
     * @returns Test readiness only.
     */ status: async () => ({ ok: true, value: 'ready' }),
    /** Does not generate a phrase for this reveal-only test.
     * @returns A deterministic unsupported-action failure.
     */ create: async () => ({ ok: false, error: { code: 'unused', message: 'Unused.' } }),
    reveal,
  };
  const protection: SensitiveScreenPort = {
    /** Waits for explicit native protection completion in the test.
     * @returns A deferred capture lease.
     */ acquire: async () =>
      await new Promise<string>((resolve) => {
        unlock = resolve;
      }),
    /** Releases the nonsecret test lease.
     * @returns Completion.
     */ release: async () => undefined,
  };
  const subscriptions = jest.spyOn(AppState, 'addEventListener');
  const hook = await renderHook(() => useRecoveryFlow(service, protection));
  await act(() => hook.result.current.reveal());
  expect(reveal).not.toHaveBeenCalled();
  await act(() => {
    unlock?.('test-lease');
  });
  await act(() => hook.result.current.reveal());
  expect(hook.result.current.words.join(' ')).toBe('PUBLIC VECTOR PLACEHOLDER');
  const background = subscriptions.mock.calls.find(([event]) => event === 'change')?.[1];
  await act(() => {
    background?.('background');
  });
  expect(hook.result.current.words).toEqual([]);
  expect(phrase).toBe('');
  await hook.unmount();
  subscriptions.mockRestore();
}, 30000);
