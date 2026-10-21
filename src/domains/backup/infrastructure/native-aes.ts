import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from 'expo-crypto';
import type { AeadPort } from '../application/crypto-ports';

/** Native AES-GCM mapping; combined sealed-data bytes must never be written as container content. */
export const nativeAead: AeadPort = {
  /** Uses the reviewed native AES-256-GCM implementation and extracts ciphertext/tag separately.
   * @param input Exact key, nonce, header AAD and bounded plaintext.
   * @returns Ciphertext excluding nonce/tag, plus the 16-byte tag; native failures reject.
   */
  seal: async (input) => {
    const key = await AESEncryptionKey.import(input.key);
    const sealed = await aesEncryptAsync(input.plaintext, key, {
      nonce: { bytes: input.nonce },
      additionalData: input.aad,
      tagLength: 16,
    });
    const [ciphertext, tag] = await Promise.all([
      sealed.ciphertext({ includeTag: false }),
      sealed.tag(),
    ]);
    return { ciphertext, tag };
  },
  /** Authenticates the supplied header and tag before exposing any plaintext.
   * @param input Exact key/nonce/AAD plus separate ciphertext and authentication tag.
   * @returns Authenticated plaintext only; wrong keys and damaged data reject identically.
   */
  open: async (input) => {
    const key = await AESEncryptionKey.import(input.key);
    const sealed = AESSealedData.fromParts(input.nonce, input.ciphertext, input.tag);
    return await aesDecryptAsync(sealed, key, { additionalData: input.aad, output: 'bytes' });
  },
};
