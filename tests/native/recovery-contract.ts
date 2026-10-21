import { randomUUID } from 'expo-crypto';
import { createSecureRecoveryStore } from '@/domains/backup/infrastructure/secure-recovery-store';
import { nativeRandom } from '@/domains/backup/infrastructure/random-source';
import { encodeMnemonic, decodeMnemonic } from '@/domains/backup/infrastructure/mnemonic-codec';
import type { ContractReport } from './contract-report';

/** Verifies real protected byte storage and bundled mnemonic conversion in disposable slots.
 * @returns Sanitized names only; public-vector entropy is removed in the owning finally block.
 */
export const runRecoveryContract = async (): Promise<ContractReport> => {
  const store = createSecureRecoveryStore('plan-bud-native-contract');
  const ref = { profileId: 'public-vector-contract', generation: randomUUID() };
  const entropy = new Uint8Array(16);
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  try {
    await store.write({ ...ref, entropy });
    const reopened = await createSecureRecoveryStore('plan-bud-native-contract').read(ref);
    if (reopened?.entropy.length === 16 && reopened.entropy.every((byte) => byte === 0))
      passed.push('protected-secret-reopen');
    else failed.push({ name: 'protected-secret-reopen', code: 'native-storage-mismatch' });
    reopened?.entropy.fill(0);
    const decoded = decodeMnemonic(encodeMnemonic(entropy));
    if (decoded.ok && decoded.value.every((byte) => byte === 0))
      passed.push('bundled-mnemonic-vector');
    else failed.push({ name: 'bundled-mnemonic-vector', code: 'vector-mismatch' });
    if (decoded.ok) decoded.value.fill(0);
    const first = nativeRandom.bytes(32);
    const second = nativeRandom.bytes(32);
    if (
      first.length === 32 &&
      second.length === 32 &&
      first.some((byte, index) => byte !== second[index])
    )
      passed.push('native-random-source');
    else failed.push({ name: 'native-random-source', code: 'native-randomness-unavailable' });
    first.fill(0);
    second.fill(0);
  } catch {
    failed.push({ name: 'native-recovery', code: 'native-operation-failed' });
  } finally {
    entropy.fill(0);
    try {
      await store.remove(ref);
      if ((await store.read(ref)) !== null)
        failed.push({ name: 'native-recovery-cleanup', code: 'slot-not-removed' });
    } catch {
      failed.push({ name: 'native-recovery-cleanup', code: 'cleanup-failed' });
    }
  }
  return { passed, failed };
};
