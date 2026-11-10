import { setStringAsync } from 'expo-clipboard';
import type { CopyRecoveryPhrase } from '../application/recovery-ports';

/** Marks the copied words as sensitive so Android can obscure clipboard previews.
 * @param words The twelve recovery words in phrase order.
 * @returns Copy outcome, or rejection on native failure for the view's operation handler.
 */
export const copyRecoveryPhrase: CopyRecoveryPhrase = async (words) =>
  (await setStringAsync(words.join(' '), { android: { isSensitive: true } }))
    ? { ok: true, value: undefined }
    : { ok: false, error: { code: 'clipboard', message: 'Unable to copy the recovery phrase.' } };
