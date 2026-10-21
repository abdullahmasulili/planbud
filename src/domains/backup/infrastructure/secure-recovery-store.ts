import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import { isRecord, isText } from '@/shared/domain/validation';
import type { RecoveryRef, RecoveryStorePort } from '../application/recovery-ports';

/** Derives a safe generation-specific slot from bounded, nonsecret identities.
 * @param ref Profile and generation binding; raw IDs never become filenames or native keys.
 * @param namespace Explicit isolated namespace for native contracts.
 * @returns SecureStore-compatible key with unambiguous identity hashing.
 * @throws When the identity or namespace is malformed.
 */
const slot = (ref: RecoveryRef, namespace: string): string => {
  if (
    !isText(ref.profileId, MAX_ID_LENGTH) ||
    !isText(ref.generation, MAX_ID_LENGTH) ||
    !/^[a-z0-9-]{1,60}$/.test(namespace)
  )
    throw new Error('Invalid recovery slot.');
  return `${namespace}.${bytesToHex(sha256(utf8ToBytes(JSON.stringify([ref.profileId, ref.generation]))))}`;
};

/** Uses Android Keystore-backed SecureStore slots; values never enter general persistence.
 * @param namespace Product namespace or a disposable native-test namespace.
 * @returns Protected storage capability; native errors reject for workflow translation.
 */
export const createSecureRecoveryStore = (
  namespace = 'plan-bud-recovery-v1',
): RecoveryStorePort => ({
  /** Reads a fresh entropy copy and validates its exact slot identity.
   * @param ref Nonsecret active generation.
   * @returns Protected record or absence; malformed/native failures reject without fallback.
   */
  read: async (ref) => {
    const text = await SecureStore.getItemAsync(slot(ref, namespace));
    if (text === null) return null;
    if (text.length > 1000) throw new Error('Invalid protected record.');
    const value: unknown = JSON.parse(text);
    if (
      !isRecord(value) ||
      value.profileId !== ref.profileId ||
      value.generation !== ref.generation ||
      typeof value.entropy !== 'string' ||
      !/^[a-f0-9]{32}$/.test(value.entropy)
    )
      throw new Error('Invalid protected record.');
    return { ...ref, entropy: hexToBytes(value.entropy) };
  },
  /** Saves one generation without overwriting the previously active slot.
   * @param record Original 16-byte entropy and nonsecret slot binding.
   * @returns Completion; rejects native storage failure.
   */
  write: async (record) => {
    if (record.entropy.length !== 16) throw new Error('Invalid protected entropy.');
    await SecureStore.setItemAsync(
      slot(record, namespace),
      JSON.stringify({
        profileId: record.profileId,
        generation: record.generation,
        entropy: bytesToHex(record.entropy),
      }),
    );
  },
  /** Removes only the specified app-owned protected generation.
   * @param ref Nonsecret generation reference.
   * @returns Completion or a native deletion failure.
   */
  remove: async (ref) => {
    await SecureStore.deleteItemAsync(slot(ref, namespace));
  },
});
