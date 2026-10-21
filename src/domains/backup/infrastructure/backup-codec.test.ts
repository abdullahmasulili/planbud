import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { randomBytes } from 'node:crypto';
import fixture from '../../../../tests/fixtures/crypto/container-v1.json';
import nist from '../../../../tests/fixtures/crypto/nist-gcm-256.json';
import { hostAead } from '../../../../tests/helpers/host-aead';
import { deriveBackupKey } from './key-derivation';
import { createBackupCodec } from './backup-codec';
import { parseContainer } from '../domain/container';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';

it('BACK-001 verifies the independent host AES adapter against published NIST plaintext/AAD/tag bytes', async () => {
  expect(
    await hostAead.seal({
      key: hexToBytes(nist.Key),
      nonce: hexToBytes(nist.IV),
      aad: hexToBytes(nist.AAD),
      plaintext: hexToBytes(nist.PT),
    }),
  ).toEqual({ ciphertext: hexToBytes(nist.CT), tag: hexToBytes(nist.Tag) });
});

it('BACK-001 verifies RFC 5869 test case 1 and the independently derived application key', () => {
  expect(
    bytesToHex(
      hkdf(
        sha256,
        new Uint8Array(22).fill(11),
        hexToBytes('000102030405060708090a0b0c'),
        hexToBytes('f0f1f2f3f4f5f6f7f8f9'),
        42,
      ),
    ),
  ).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  expect(
    bytesToHex(deriveBackupKey(hexToBytes(fixture.entropyHex), hexToBytes(fixture.saltHex))),
  ).toBe(fixture.keyHex);
  expect(() => deriveBackupKey(new Uint8Array(32), new Uint8Array(32))).toThrow();
});

it('BACK-001 opens the independent fixed container and uses exact header offsets without nonce duplication', async () => {
  const codec = createBackupCodec({ bytes: randomBytes }, hostAead);
  const bytes = hexToBytes(fixture.containerHex);
  const parsed = parseContainer(bytes);
  expect(parsed).toMatchObject({
    ok: true,
    value: { salt: hexToBytes(fixture.saltHex), nonce: hexToBytes(fixture.nonceHex) },
  });
  expect(await codec.openBackup(bytes, hexToBytes(fixture.entropyHex))).toEqual({
    ok: true,
    value: hexToBytes(fixture.plaintextHex),
  });
  const one = await codec.sealBackup(hexToBytes(fixture.plaintextHex), new Uint8Array(16));
  const two = await codec.sealBackup(hexToBytes(fixture.plaintextHex), new Uint8Array(16));
  expect(one.length).toBe(76 + fixture.plaintextHex.length / 2);
  expect(bytesToHex(one.slice(12, 44))).not.toBe(bytesToHex(two.slice(12, 44)));
  expect(bytesToHex(one.slice(44, 56))).not.toBe(bytesToHex(two.slice(44, 56)));
});

it('RESTORE-002 rejects every altered header, ciphertext or tag byte and uses a combined authentication error', async () => {
  const codec = createBackupCodec({ bytes: randomBytes }, hostAead);
  const bytes = hexToBytes(fixture.containerHex);
  for (let index = 0; index < bytes.length; index += 1) {
    const altered = bytes.slice();
    altered[index] = (altered[index] ?? 0) ^ 1;
    expect(await codec.openBackup(altered, new Uint8Array(16))).toMatchObject({ ok: false });
  }
  const wrongKey = await codec.openBackup(bytes, new Uint8Array(16).fill(1));
  const damaged = bytes.slice();
  damaged[60] = (damaged[60] ?? 0) ^ 1;
  expect(await codec.openBackup(damaged, new Uint8Array(16))).toEqual(wrongKey);
});

it('BACK-001 bounds structural input before native decryption or output allocation', async () => {
  const codec = createBackupCodec({ bytes: randomBytes }, hostAead);
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array(76),
    new Uint8Array(MAX_BACKUP_BYTES + 1),
    hexToBytes(fixture.containerHex).slice(0, -1),
    Uint8Array.from([...hexToBytes(fixture.containerHex), 0]),
  ])
    expect(await codec.openBackup(bytes, new Uint8Array(16))).toMatchObject({ ok: false });
  await expect(codec.sealBackup(new Uint8Array(), new Uint8Array(16))).rejects.toThrow();
  await expect(
    codec.sealBackup(new Uint8Array(MAX_BACKUP_BYTES), new Uint8Array(16)),
  ).rejects.toThrow();
});
