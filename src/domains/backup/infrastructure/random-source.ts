import { getRandomValues } from 'expo-crypto';
import type { RandomPort } from '../application/recovery-ports';

/** Uses the Expo native-only fill API, avoiding getRandomBytes' development PRNG fallback.
 * @param length Requested native random-byte count, from 1 through 1024.
 * @returns Fresh CSPRNG bytes; native unavailability rejects synchronously with no fallback.
 * @throws When the count is invalid or native randomness is unavailable.
 */
const bytes = (length: number): Uint8Array => {
  if (!Number.isInteger(length) || length < 1 || length > 1024)
    throw new Error('Invalid random-byte request.');
  return getRandomValues(new Uint8Array(length));
};
/** Native capability carries no key material or mutable application data. */
export const nativeRandom: RandomPort = { bytes };
