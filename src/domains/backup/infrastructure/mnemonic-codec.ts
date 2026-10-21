import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type { Result } from '@/shared/domain/result';

/** Encodes exactly 128 native-random entropy bits with the bundled English BIP-39 checksum.
 * @param entropy Original 16-byte entropy; never a wallet seed.
 * @returns Twelve ordered English words.
 * @throws When a caller supplies any other entropy length.
 */
export const encodeMnemonic = (entropy: Uint8Array): string => {
  if (entropy.length !== 16) throw new Error('Recovery entropy must contain 128 bits.');
  return entropyToMnemonic(entropy, wordlist);
};

/** Normalizes pasted English words and validates membership, order and checksum.
 * @param words Untrusted recovery input; bounded before normalization.
 * @returns Original 16-byte entropy or a sanitized phrase error.
 */
export const decodeMnemonic = (words: string): Result<Uint8Array> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-phrase',
      message:
        'Enter all 12 English recovery words in their original order and check their spelling.',
    },
  };
  if (words.length > 300) return invalid;
  const normalized = words.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
  if (normalized.split(' ').length !== 12) return invalid;
  try {
    const entropy = mnemonicToEntropy(normalized, wordlist);
    return entropy.length === 16 ? { ok: true, value: entropy } : invalid;
  } catch {
    return invalid;
  }
};

/** Binds a local recovery generation to the exact decoded secret without storing it in SQLite.
 * @param entropy Exactly 16 bytes of original recovery entropy.
 * @returns Lowercase SHA-256 of domain separation followed by the entropy.
 * @throws When the entropy length is invalid.
 */
export const recoveryFingerprint = (entropy: Uint8Array): string => {
  if (entropy.length !== 16) throw new Error('Invalid recovery entropy.');
  return bytesToHex(sha256(concatBytes(utf8ToBytes('plan-bud/recovery/v1'), entropy)));
};
