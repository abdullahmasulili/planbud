import { createCipheriv, createDecipheriv } from 'node:crypto';
import type { AeadPort } from '@/domains/backup/application/crypto-ports';

/** Independent OpenSSL-backed host adapter; never reachable from the app entry graph. */
export const hostAead: AeadPort = {
  /** Seals test bytes using Node's independently maintained AES implementation.
   * @param input Key, nonce, AAD and plaintext supplied by vector tests.
   * @returns Ciphertext and tag, without an extra nonce.
   */
  seal: async (input) => {
    const cipher = createCipheriv('aes-256-gcm', input.key, input.nonce, { authTagLength: 16 });
    cipher.setAAD(input.aad);
    return {
      ciphertext: Uint8Array.from(Buffer.concat([cipher.update(input.plaintext), cipher.final()])),
      tag: Uint8Array.from(cipher.getAuthTag()),
    };
  },
  /** Authenticates test bytes before returning any plaintext.
   * @param input Key, nonce, AAD, ciphertext and tag.
   * @returns Plaintext only after the independent implementation verifies the tag.
   */
  open: async (input) => {
    const decipher = createDecipheriv('aes-256-gcm', input.key, input.nonce, { authTagLength: 16 });
    decipher.setAAD(input.aad);
    decipher.setAuthTag(input.tag);
    return Uint8Array.from(Buffer.concat([decipher.update(input.ciphertext), decipher.final()]));
  },
};
