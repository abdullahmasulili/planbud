import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';
import type { Result } from '@/shared/domain/result';
import type { AeadPort, BackupCodec } from '../application/crypto-ports';
import type { RandomPort } from '../application/recovery-ports';
import { createHeader, parseContainer, HEADER_BYTES, TAG_BYTES } from '../domain/container';
import { deriveBackupKey } from './key-derivation';

/** Composes strict format parsing, maintained HKDF and an authenticated native encryption port.
 * @param random Native-only CSPRNG; deterministic sources are restricted to labeled vector tests.
 * @param aead Authenticated encryption boundary verified against independent vectors.
 * @returns Bounded container sealing/opening, with no filesystem or snapshot side effects.
 */
export const createBackupCodec = (random: RandomPort, aead: AeadPort): BackupCodec => ({
  /** Seals nonempty bytes with fresh salt/nonce and the entire header as additional data.
   * @param payload Validated UTF-8 snapshot bytes, bounded before encryption allocation.
   * @param entropy Original 16-byte recovery entropy.
   * @returns Complete version-1 container; invalid input/native failure rejects.
   */
  sealBackup: async (payload, entropy) => {
    if (payload.length < 1 || payload.length > MAX_BACKUP_BYTES - HEADER_BYTES - TAG_BYTES)
      throw new Error('Snapshot exceeds the supported backup size.');
    const salt = random.bytes(32);
    const nonce = random.bytes(12);
    const header = createHeader(payload.length, salt, nonce);
    const key = deriveBackupKey(entropy, salt);
    try {
      const sealed = await aead.seal({ key, nonce, aad: header, plaintext: payload });
      if (sealed.ciphertext.length !== payload.length || sealed.tag.length !== TAG_BYTES)
        throw new Error('Invalid native encryption output.');
      const bytes = new Uint8Array(HEADER_BYTES + payload.length + TAG_BYTES);
      bytes.set(header);
      bytes.set(sealed.ciphertext, HEADER_BYTES);
      bytes.set(sealed.tag, HEADER_BYTES + payload.length);
      return bytes;
    } finally {
      key.fill(0);
    }
  },
  /** Authenticates a bounded owned copy and never returns a partial decryption.
   * @param container Untrusted bytes; external mutation cannot alter an in-flight native operation.
   * @param entropy Original decoded recovery entropy.
   * @returns Authenticated payload or a structural/combined key-or-corruption failure.
   */
  openBackup: async (container, entropy) => {
    if (container.length > MAX_BACKUP_BYTES || container.length <= HEADER_BYTES + TAG_BYTES)
      return {
        ok: false,
        error: {
          code: 'invalid-container',
          message: 'Choose a complete .planbud backup of at most 16 MiB.',
        },
      };
    const parsed = parseContainer(container.slice());
    if (!parsed.ok) return parsed;
    let key: Uint8Array | undefined;
    try {
      key = deriveBackupKey(entropy, parsed.value.salt);
      const plaintext = await aead.open({
        key,
        nonce: parsed.value.nonce,
        aad: parsed.value.header,
        ciphertext: parsed.value.ciphertext,
        tag: parsed.value.tag,
      });
      if (plaintext.length !== parsed.value.ciphertext.length) {
        plaintext.fill(0);
        throw new Error('Invalid native decryption output.');
      }
      return { ok: true, value: plaintext };
    } catch {
      return {
        ok: false,
        error: {
          code: 'backup-authentication-failed',
          message: 'The recovery phrase does not match this file, or the backup is damaged.',
        },
      };
    } finally {
      key?.fill(0);
    }
  },
});

/** Seals a validated snapshot with Android native capabilities.
 * @param payload Bounded nonempty UTF-8 bytes.
 * @param entropy Original 16-byte recovery entropy.
 * @returns Complete authenticated container; native failures reject for workflow translation.
 */
export const sealBackup = async (payload: Uint8Array, entropy: Uint8Array): Promise<Uint8Array> => {
  const { nativeRandom } = await import('./random-source');
  const { nativeAead } = await import('./native-aes');
  return await createBackupCodec(nativeRandom, nativeAead).sealBackup(payload, entropy);
};
/** Opens a bounded container with Android native authenticated decryption.
 * @param container Untrusted encrypted input.
 * @param entropy Original decoded recovery entropy.
 * @returns Authenticated payload or sanitized format/authentication failure.
 */
export const openBackup = async (
  container: Uint8Array,
  entropy: Uint8Array,
): Promise<Result<Uint8Array>> => {
  const { nativeRandom } = await import('./random-source');
  const { nativeAead } = await import('./native-aes');
  return await createBackupCodec(nativeRandom, nativeAead).openBackup(container, entropy);
};
