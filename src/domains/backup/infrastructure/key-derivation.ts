import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/** Derives an application-specific AES key without wallet seed derivation.
 * @param entropy Exactly 16 bytes decoded from the English 12-word phrase.
 * @param salt Exactly 32 fresh export salt bytes from the authenticated header.
 * @returns A 32-byte HKDF-SHA-256 output; security entropy remains 128 bits.
 * @throws When entropy or salt length differs from profile 1.
 */
export const deriveBackupKey = (entropy: Uint8Array, salt: Uint8Array): Uint8Array => {
  if (entropy.length !== 16 || salt.length !== 32) throw new Error('Invalid backup key inputs.');
  return hkdf(sha256, entropy, salt, utf8ToBytes('plan-bud/backup/v1'), 32);
};
