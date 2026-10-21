import { createBackupFiles } from './backup-files';
import type { EncryptedDocuments, ChunkReader } from './backup-files';
import fixture from '../../../../tests/fixtures/crypto/container-v1.json';
import { hexToBytes } from '@noble/hashes/utils.js';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';

it('BACK-001 reads actual bounded chunks despite missing or false provider metadata and closes every handle', async () => {
  const bytes = hexToBytes(fixture.containerHex);
  let closed = 0;
  for (const reportedSize of [null, 1, bytes.length + 100]) {
    let offset = 0;
    const reader: ChunkReader = {
      /** Supplies partial provider reads.
       * @param maximum Maximum bytes requested by the adapter.
       * @returns At most seven ciphertext bytes, or EOF.
       */ read: async (maximum) => {
        expect(maximum).toBeLessThanOrEqual(65536);
        const chunk = bytes.slice(offset, offset + Math.min(7, maximum));
        offset += chunk.length;
        return chunk;
      },
      /** Releases the test provider handle.
       * @returns Completion.
       */ close: async () => {
        closed += 1;
      },
    };
    const documents: EncryptedDocuments = {
      /** Selects an existing ciphertext stream.
       * @returns Untrusted metadata and a bounded reader.
       */ pick: async () => ({ reportedSize, reader }),
      /** Simulates save cancellation.
       * @returns No destination.
       */ destination: async () => null,
    };
    expect(await createBackupFiles(documents).pickEncrypted()).toEqual({ ok: true, value: bytes });
  }
  expect(closed).toBe(3);
});

it('RESTORE-002 rejects oversized actual data, truncation and revoked grants without deleting source files', async () => {
  for (const mode of ['oversized', 'truncated', 'revoked']) {
    let offset = 0;
    let closed = false;
    const documents: EncryptedDocuments = {
      /** Supplies deliberately untrustworthy provider reads.
       * @returns Ciphertext reader with false size metadata.
       */ pick: async () => ({
        reportedSize: 1,
        reader: {
          /** Reads bounded chunks or simulates grant revocation.
           * @param maximum Maximum requested byte count.
           * @returns Bounded synthetic ciphertext or a rejected grant.
           */ read: async (maximum) => {
            if (mode === 'revoked') throw new Error('private provider details');
            if (mode === 'truncated') {
              const data = offset
                ? new Uint8Array()
                : hexToBytes(fixture.containerHex).slice(0, -1);
              offset += 1;
              return data;
            }
            const chunk = new Uint8Array(Math.min(maximum, MAX_BACKUP_BYTES + 1 - offset));
            offset += chunk.length;
            return chunk;
          },
          /** Releases the existing source handle without removing the source.
           * @returns Completion.
           */ close: async () => {
            closed = true;
          },
        },
      }),
      /** Simulates canceled destination selection.
       * @returns No destination.
       */ destination: async () => null,
    };
    expect(await createBackupFiles(documents).pickEncrypted()).toMatchObject({ ok: false });
    expect(closed).toBe(true);
    expect(offset).toBeLessThanOrEqual(MAX_BACKUP_BYTES + 1);
  }
});

it('BACK-001 distinguishes picker/save cancellation from storage failure and refuses plaintext writes', async () => {
  const files = createBackupFiles({
    /** Cancels input selection.
     * @returns No source.
     */ pick: async () => null,
    /** Cancels output selection.
     * @returns No destination.
     */ destination: async () => null,
  });
  expect(await files.pickEncrypted()).toEqual({ ok: true, value: null });
  expect(await files.saveEncrypted(hexToBytes(fixture.containerHex))).toEqual({
    ok: true,
    value: 'canceled',
  });
  expect(await files.saveEncrypted(new TextEncoder().encode('plaintext'))).toMatchObject({
    ok: false,
  });
  const failure = createBackupFiles({
    /** Cancels unused input selection.
     * @returns No source.
     */ pick: async () => null,
    /** Supplies a full/revoked destination.
     * @returns A failing write capability.
     */ destination: async () => ({
      /** Simulates full storage without exposing provider details.
       * @returns A rejected write.
       */ write: async () => {
        throw new Error('private provider details');
      },
    }),
  });
  expect(await failure.saveEncrypted(hexToBytes(fixture.containerHex))).toMatchObject({
    ok: false,
    error: { code: 'backup-save-failed' },
  });
});
