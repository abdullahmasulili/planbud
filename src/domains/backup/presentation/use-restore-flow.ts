import { useCallback, useRef, useState } from 'react';
import type { RestoreService, RestorePreview } from '../application/restore-service';
import type { BackupFilesPort } from '../application/file-ports';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { useSensitiveView } from './use-sensitive-view';
import { useOperation } from '@/shared/presentation/use-operation';

/** Owns ciphertext and nonsecret preview locally while the service owns decrypted session data.
 * @param service Private authenticated preparation and atomic replacement workflows.
 * @param files Encrypted-only provider capabilities.
 * @param protection Native capture/recents protection.
 * @returns Explicit select, enter, review, replace and cancel phases with background disposal.
 */
export const useRestoreFlow = (
  service: RestoreService,
  files: BackupFilesPort,
  protection: SensitiveScreenPort,
) => {
  const [phase, setPhase] = useState<'select' | 'phrase' | 'review' | 'done'>('select');
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [notice, setNotice] = useState('');
  const ciphertext = useRef<Uint8Array | null>(null);
  const operation = useOperation();
  /** Cancels unconfirmed plaintext ownership and clears all local transient review/input views. */
  const dispose = useCallback(() => {
    service.cancelRestore('');
    ciphertext.current = null;
    setPreview(null);
    setPhase('select');
  }, [service]);
  const sensitive = useSensitiveView(protection, dispose);
  /** Picks ciphertext only; canceling a native picker does not claim a restore or save. */
  const select = () =>
    operation.run(files.pickEncrypted, (bytes) => {
      if (bytes) {
        ciphertext.current = bytes;
        setNotice('');
        setPhase('phrase');
      } else setNotice('Import selection canceled. Local data is unchanged.');
    });
  /** Authenticates the complete phrase and validates every record before showing replacement counts.
   * @param words Twelve transient recovery words from the protected input component.
   */
  const prepare = (words: string) => {
    const bytes = ciphertext.current;
    if (!bytes || !sensitive.ready) return;
    operation.run(
      async () => await service.prepareRestore(bytes, words),
      (value) => {
        ciphertext.current = null;
        setPreview(value);
        setPhase('review');
      },
    );
  };
  /** Commits only after the explicit replacement acknowledgment in the review form. */
  const confirm = () => {
    if (!preview) return;
    operation.run(
      async () => await service.confirmRestore(preview.token),
      (value) => {
        setPreview(null);
        setPhase('done');
        setNotice(
          value.recoveryReady
            ? 'Local data replaced. Future exports use the imported phrase.'
            : 'Local data replaced. Export is disabled until you save the same phrase in protected storage through Recovery.',
        );
      },
    );
  };
  return {
    phase,
    preview,
    notice,
    message: sensitive.message || operation.message,
    ready: sensitive.ready,
    busy: operation.busy,
    select,
    prepare,
    confirm,
    dispose,
  };
};
