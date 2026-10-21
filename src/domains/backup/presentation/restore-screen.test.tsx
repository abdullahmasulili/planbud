import { useEffect } from 'react';
import type { EffectCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { RestoreScreen } from './restore-screen';
import type { RestoreService } from '../application/restore-service';
import type { BackupFilesPort } from '../application/file-ports';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

/** Supplies isolated focus ownership for a component interaction test.
 * @param effect Focus synchronization under test.
 * @returns Effect registration result.
 */
const useTestFocus = (effect: EffectCallback) => useEffect(effect, [effect]);

it('RESTORE-001 requires a separate destructive acknowledgment after authenticated count review', async () => {
  jest.mocked(useFocusEffect).mockImplementation(useTestFocus);
  const confirm = jest.fn(
    async () =>
      ({ ok: true, value: { recoveryReady: true } }) satisfies Awaited<
        ReturnType<RestoreService['confirmRestore']>
      >,
  );
  const service: RestoreService = {
    /** Returns counts only after the input form is explicitly submitted.
     * @returns A deterministic nonsecret review.
     */ prepareRestore: async () => ({
      ok: true,
      value: {
        token: 'review',
        sourceRevision: 1,
        createdAt: '2026-10-20T00:00:00.000Z',
        counts: { transactions: 2 },
      },
    }),
    confirmRestore: confirm,
    /** Disposes an unused deterministic test preview.
     * @returns Completion without source mutation.
     */ cancelRestore: () => undefined,
    /** Completes an unused reset capability.
     * @returns Completion.
     */ resetProfile: async () => ({ ok: true, value: { secretCleanupPending: false } }),
  };
  const files: BackupFilesPort = {
    /** Supplies ciphertext placeholder bytes; authentication belongs to the injected use case.
     * @returns Nonsecret selection.
     */ pickEncrypted: async () => ({ ok: true, value: new Uint8Array([1]) }),
    /** Cancels an unused export action.
     * @returns Explicit cancellation.
     */ saveEncrypted: async () => ({ ok: true, value: 'canceled' }),
  };
  const protection: SensitiveScreenPort = {
    /** Acquires a fake protection lease before exposing inputs.
     * @returns Nonsecret lease identity.
     */ acquire: async () => 'protected',
    /** Completes native test cleanup.
     * @returns Completion.
     */ release: async () => undefined,
  };
  await render(
    <TestScreen>
      <RestoreScreen service={service} files={files} protection={protection} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose .planbud file' }));
  expect(screen.getByLabelText('12 recovery words in order')).toHaveProp('autoComplete', 'off');
  expect(screen.getByLabelText('12 recovery words in order')).toHaveProp(
    'importantForAutofill',
    'no',
  );
  await fireEvent.changeText(
    screen.getByLabelText('12 recovery words in order'),
    'public test placeholder',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Authenticate and preview' }));
  expect(screen.getByText('transactions: 2')).toBeOnTheScreen();
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Replace local data' })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: 'Replace all current local records with this backup' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Replace local data' }));
  expect(confirm).toHaveBeenCalledWith('review');
}, 30000);
