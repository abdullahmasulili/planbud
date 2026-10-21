import { mkdirSync, writeFileSync } from 'node:fs';
import { createCipheriv, hkdfSync } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { snapshotFixture, stressSnapshot } from '../tests/helpers/snapshot-fixture.ts';

// Public BIP39 zero-entropy interoperability vector. Never use these fixtures for personal data.
/** Encrypts nonpersonal fixtures with the published zero-entropy vector, never a user's key.
 * @param snapshot Synthetic source records.
 * @returns A deterministic interoperable container for disposable acceptance tests only.
 */
const sealFixture = (snapshot) => {
  const salt = Buffer.alloc(32, 42);
  const nonce = Buffer.alloc(12, 7);
  const payload = Buffer.from(JSON.stringify(snapshot));
  const header = Buffer.alloc(60);
  header.write('PLANBUD');
  header.writeUInt16BE(1, 8);
  header.writeUInt16BE(1, 10);
  salt.copy(header, 12);
  nonce.copy(header, 44);
  header.writeUInt32BE(payload.length, 56);
  const key = Buffer.from(hkdfSync('sha256', Buffer.alloc(16), salt, 'plan-bud/backup/v1', 32));
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(header);
    return Buffer.concat([header, cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
  } finally {
    key.fill(0);
    payload.fill(0);
  }
};
const container = sealFixture(snapshotFixture());
const folder = 'tests/fixtures/maestro';
mkdirSync(folder, { recursive: true });
writeFileSync(`${folder}/restore-valid.planbud`, container);
container[container.length - 1] ^= 1;
writeFileSync(`${folder}/restore-corrupt.planbud`, container);
if (process.argv.includes('--stress')) {
  const snapshot = stressSnapshot();
  writeFileSync(`${folder}/stress-50000.planbud`, sealFixture(snapshot));
  writeFileSync(
    `${folder}/stress-50001.planbud`,
    sealFixture({
      ...snapshot,
      categories: [
        ...snapshot.categories,
        { id: 'extra', name: 'Extra', kind: 'flexible', archived: false },
      ],
    }),
  );
  writeFileSync(`${folder}/stress-oversized.planbud`, Buffer.alloc(16777217));
}
process.stdout.write(
  'Created public-vector encrypted fixtures for disposable Android acceptance.\n',
);
