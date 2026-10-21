import { randomBytes } from 'node:crypto';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { hostAead } from '../../../../tests/helpers/host-aead';
import { createBackupCodec } from '../infrastructure/backup-codec';
import { createSnapshotRepository } from '../infrastructure/snapshot-repository';
import { createRecoveryMetadata } from '../infrastructure/recovery-metadata';
import { recoveryFingerprint } from '../infrastructure/mnemonic-codec';
import { createExportService } from './export-service';
import type { RecoveryStorePort } from './recovery-ports';

it('BACK-001 gates export on the matching ready generation, encrypts validated data before file I/O, and distinguishes cancellation', async () => {
  const fixture = await createTransactionFixture();
  try {
    // Public zero-entropy BIP-39 vector; never generated user recovery material.
    const entropy = new Uint8Array(16);
    const metadata = createRecoveryMetadata(fixture.database);
    const saved: Uint8Array[] = [];
    let canceled = false;
    let missing = false;
    const store: RecoveryStorePort = {
      /** Reads a fresh labeled vector copy.
       * @param ref Requested nonsecret slot identity.
       * @returns Matching vector record or simulated absence.
       */ read: async (ref) => (missing ? null : { ...ref, entropy: entropy.slice() }),
      /** Completes unused test storage.
       * @returns Completion.
       */ write: async () => undefined,
      /** Completes unused test deletion.
       * @returns Completion.
       */ remove: async () => undefined,
    };
    const codec = createBackupCodec({ bytes: randomBytes }, hostAead);
    const service = createExportService({
      snapshots: createSnapshotRepository(fixture.database, () => '2026-10-20T00:00:00.000Z'),
      metadata,
      store,
      fingerprint: recoveryFingerprint,
      codec,
      files: {
        /** Records only encrypted file writes.
         * @param bytes Authenticated container received by the file boundary.
         * @returns Explicit saved or canceled result.
         */ saveEncrypted: async (bytes) => {
          if (canceled) return { ok: true, value: 'canceled' };
          saved.push(bytes.slice());
          return { ok: true, value: 'saved' };
        },
        /** Cancels an unused import operation.
         * @returns No selected file.
         */ pickEncrypted: async () => ({ ok: true, value: null }),
      },
    });
    expect(await service.exportBackup()).toMatchObject({ ok: false });
    const state = {
      profileId: fixture.profile.id,
      generation: 'public-vector',
      fingerprint: recoveryFingerprint(entropy),
      status: 'pending',
    };
    await metadata.activate({
      expectedRevision: await fixture.database.revision(),
      state: { ...state, status: 'pending' },
    });
    expect(await service.exportBackup()).toMatchObject({ ok: false });
    await metadata.activate({
      expectedRevision: await fixture.database.revision(),
      state: { ...state, status: 'ready' },
    });
    missing = true;
    expect(await service.exportBackup()).toMatchObject({ ok: false });
    expect(saved).toEqual([]);
    missing = false;
    canceled = true;
    expect(await service.exportBackup()).toEqual({ ok: true, value: 'canceled' });
    canceled = false;
    expect(await service.exportBackup()).toEqual({ ok: true, value: 'saved' });
    const encrypted = saved[0];
    if (!encrypted) throw new Error('Encrypted file missing');
    expect(new TextDecoder().decode(encrypted)).not.toMatch(/currency|appearance|recovery|Food/);
    const opened = await codec.openBackup(encrypted, entropy);
    if (!opened.ok) throw new Error('Export did not authenticate');
    expect(JSON.parse(new TextDecoder().decode(opened.value))).toMatchObject({
      profile: fixture.profile,
      categories: [{ name: 'Food' }],
    });
  } finally {
    await fixture.database.close();
  }
});
