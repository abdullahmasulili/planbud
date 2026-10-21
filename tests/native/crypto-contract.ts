import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import nist from '../fixtures/crypto/nist-gcm-256.json';
import fixture from '../fixtures/crypto/container-v1.json';
import { nativeAead } from '@/domains/backup/infrastructure/native-aes';
import { openBackup, sealBackup } from '@/domains/backup/infrastructure/backup-codec';
import type { ContractReport } from './contract-report';

/** Verifies native AES and the application container against independently fixed fixtures.
 * @returns Sanitized names only; vector bytes contain no user data or generated user phrase.
 */
export const runCryptoContract = async (): Promise<ContractReport> => {
  const passed: string[] = [];
  const failed: { name: string; code: string }[] = [];
  try {
    const input = {
      key: hexToBytes(nist.Key),
      nonce: hexToBytes(nist.IV),
      aad: hexToBytes(nist.AAD),
      plaintext: hexToBytes(nist.PT),
    };
    const sealed = await nativeAead.seal(input);
    const opened = await nativeAead.open({
      ...input,
      ciphertext: hexToBytes(nist.CT),
      tag: hexToBytes(nist.Tag),
    });
    if (
      bytesToHex(sealed.ciphertext) === nist.CT &&
      bytesToHex(sealed.tag) === nist.Tag &&
      bytesToHex(opened) === nist.PT
    )
      passed.push('native-nist-aes-gcm');
    else
      failed.push({
        name: 'native-nist-aes-gcm',
        code:
          bytesToHex(sealed.ciphertext) !== nist.CT
            ? 'ciphertext-mismatch'
            : bytesToHex(sealed.tag) !== nist.Tag
              ? 'tag-mismatch'
              : opened.length !== nist.PT.length / 2
                ? `plaintext-length-${opened.length}-expected-${nist.PT.length / 2}`
                : 'plaintext-mismatch',
      });
    opened.fill(0);
    input.key.fill(0);
    const result = await openBackup(
      hexToBytes(fixture.containerHex),
      hexToBytes(fixture.entropyHex),
    );
    if (result.ok && bytesToHex(result.value) === fixture.plaintextHex)
      passed.push('native-independent-container');
    else failed.push({ name: 'native-independent-container', code: 'vector-mismatch' });
    if (result.ok) result.value.fill(0);
    const encrypted = await sealBackup(
      hexToBytes(fixture.plaintextHex),
      hexToBytes(fixture.entropyHex),
    );
    const roundtrip = await openBackup(encrypted, hexToBytes(fixture.entropyHex));
    if (
      roundtrip.ok &&
      bytesToHex(roundtrip.value) === fixture.plaintextHex &&
      encrypted.length === fixture.plaintextHex.length / 2 + 76
    )
      passed.push('native-container-layout-roundtrip');
    else failed.push({ name: 'native-container-layout-roundtrip', code: 'roundtrip-mismatch' });
    if (roundtrip.ok) roundtrip.value.fill(0);
    let lengthsMatch = true;
    for (const size of [0, 1, 15, 16, 17, 31]) {
      const key = new Uint8Array(32); // Published all-zero test key; never user recovery material.
      const nonce = new Uint8Array(12).fill(size + 1);
      const plaintext = new Uint8Array(size).fill(42);
      try {
        const sealed = await nativeAead.seal({ key, nonce, plaintext, aad: new Uint8Array(0) });
        const opened = await nativeAead.open({ key, nonce, ...sealed, aad: new Uint8Array(0) });
        lengthsMatch =
          lengthsMatch && opened.length === size && opened.every((byte) => byte === 42);
        opened.fill(0);
      } finally {
        key.fill(0);
        plaintext.fill(0);
      }
    }
    if (lengthsMatch) passed.push('native-aes-exact-plaintext-lengths');
    else failed.push({ name: 'native-aes-exact-plaintext-lengths', code: 'length-mismatch' });
    const badTag = hexToBytes(nist.Tag);
    badTag[0] = (badTag[0] ?? 0) ^ 1;
    let rejected = false;
    try {
      const opened = await nativeAead.open({
        key: hexToBytes(nist.Key),
        nonce: hexToBytes(nist.IV),
        ciphertext: hexToBytes(nist.CT),
        tag: badTag,
        aad: hexToBytes(nist.AAD),
      });
      opened.fill(0);
    } catch {
      rejected = true;
    }
    if (rejected) passed.push('native-aes-rejects-damaged-tag');
    else failed.push({ name: 'native-aes-rejects-damaged-tag', code: 'authentication-bypassed' });
  } catch {
    failed.push({ name: 'native-crypto', code: 'native-operation-failed' });
  }
  return { passed, failed };
};
