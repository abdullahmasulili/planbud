import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';
import { randomUUID } from 'expo-crypto';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';

/** Coordinates Android FLAG_SECURE using independent native leases for sensitive views. */
export const sensitiveScreen: SensitiveScreenPort = {
  /** Blocks capture before a phrase or decrypted preview is exposed.
   * @returns Unique acquired lease; native failures reject before secret presentation.
   */
  acquire: async () => {
    const key = `plan-bud-${randomUUID()}`;
    await preventScreenCaptureAsync(key);
    return key;
  },
  /** Releases only this view's lease after its secret references are disposed.
   * @param key Previously acquired unique lease.
   * @returns Native release completion or a rejected cleanup operation.
   */
  release: async (key) => {
    await allowScreenCaptureAsync(key);
  },
};
