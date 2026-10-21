import type { Result } from '@/shared/domain/result';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';

export const HEADER_BYTES = 60;
export const TAG_BYTES = 16;
const MAGIC = Uint8Array.from([80, 76, 65, 78, 66, 85, 68, 0]);

/** Validated structural views; native authentication is still required before using plaintext. */
export type ContainerParts = {
  readonly header: Uint8Array;
  readonly salt: Uint8Array;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
};

/** Encodes the exact version-1 header, with its complete bytes authenticated as GCM AAD.
 * @param length Positive ciphertext length excluding the fixed 16-byte tag.
 * @param salt Fresh 32-byte native CSPRNG salt.
 * @param nonce Fresh 12-byte native CSPRNG nonce.
 * @returns The exact 60-byte header without personal or financial fields.
 * @throws When any fixed-size field or total-container bound is invalid.
 */
export const createHeader = (length: number, salt: Uint8Array, nonce: Uint8Array): Uint8Array => {
  if (
    !Number.isInteger(length) ||
    length < 1 ||
    length > MAX_BACKUP_BYTES - HEADER_BYTES - TAG_BYTES ||
    salt.length !== 32 ||
    nonce.length !== 12
  )
    throw new Error('Invalid backup header fields.');
  const header = new Uint8Array(HEADER_BYTES);
  const view = new DataView(header.buffer);
  header.set(MAGIC);
  view.setUint16(8, 1, false);
  view.setUint16(10, 1, false);
  header.set(salt, 12);
  header.set(nonce, 44);
  view.setUint32(56, length, false);
  return header;
};

/** Rejects structural attacks before key derivation, native calls, or plaintext allocation.
 * @param bytes Bounded encrypted input; returned views borrow its storage.
 * @returns Exact format/profile views or a sanitized unsupported/malformed result.
 */
export const parseContainer = (bytes: Uint8Array): Result<ContainerParts> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-container',
      message: 'Choose a complete .planbud backup of at most 16 MiB.',
    },
  };
  if (
    bytes.length <= HEADER_BYTES + TAG_BYTES ||
    bytes.length > MAX_BACKUP_BYTES ||
    MAGIC.some((byte, index) => bytes[index] !== byte)
  )
    return invalid;
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  if (view.getUint16(8, false) !== 1 || view.getUint16(10, false) !== 1)
    return {
      ok: false,
      error: {
        code: 'unsupported-container',
        message: 'This backup format requires a supported version of Plan Bud.',
      },
    };
  const length = view.getUint32(56, false);
  if (length < 1 || length !== bytes.length - HEADER_BYTES - TAG_BYTES) return invalid;
  return {
    ok: true,
    value: {
      header: bytes.subarray(0, HEADER_BYTES),
      salt: bytes.subarray(12, 44),
      nonce: bytes.subarray(44, 56),
      ciphertext: bytes.subarray(HEADER_BYTES, HEADER_BYTES + length),
      tag: bytes.subarray(HEADER_BYTES + length),
    },
  };
};
