import { encodeMnemonic, decodeMnemonic } from './mnemonic-codec';

// Public Trezor BIP-39 vector, never a generated user recovery secret.
const VECTOR =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
it('KEY-001 encodes only 128-bit entropy and verifies the published English checksum vector', () => {
  expect(encodeMnemonic(new Uint8Array(16))).toBe(VECTOR);
  expect(decodeMnemonic(`  ${VECTOR.toUpperCase().replaceAll(' ', '\n')}  `)).toEqual({
    ok: true,
    value: new Uint8Array(16),
  });
  expect(decodeMnemonic(VECTOR.replace('about', 'abandon'))).toMatchObject({ ok: false });
  expect(decodeMnemonic(VECTOR + ' about')).toMatchObject({ ok: false });
  expect(decodeMnemonic(VECTOR.replace('about', 'unknownword'))).toMatchObject({ ok: false });
  expect(() => encodeMnemonic(new Uint8Array(32))).toThrow();
});
