import type { BackupFilesPort } from '../application/file-ports';
import { MAX_BACKUP_BYTES } from '@/shared/domain/record-limits';
import { parseContainer } from '../domain/container';

/** Bounded provider stream; closing releases a descriptor without deleting the selected source. */
export type ChunkReader = {
  readonly read: (maximum: number) => Promise<Uint8Array>;
  readonly close: () => Promise<void>;
};
/** Infrastructure-only picker transport, exposing neither URI nor unbounded whole-file reads. */
export type EncryptedDocuments = {
  readonly pick: () => Promise<{
    readonly reportedSize: number | null;
    readonly reader: ChunkReader;
  } | null>;
  readonly destination: () => Promise<{
    readonly write: (bytes: Uint8Array) => Promise<void>;
  } | null>;
};

/** Reads actual ciphertext bytes under a hard bound regardless of provider metadata.
 * @param reader Already opened ciphertext-only source stream.
 * @returns Structurally validated container bytes; throws on size, format, grant or cleanup failure.
 */
const readBounded = async (reader: ChunkReader) => {
  let primary: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const maximum = Math.min(65536, MAX_BACKUP_BYTES + 1 - total);
      const chunk = await reader.read(maximum);
      if (chunk.length > maximum) throw new Error('Provider exceeded bounded read request.');
      if (!chunk.length) break;
      total += chunk.length;
      if (total > MAX_BACKUP_BYTES) throw new Error('Backup exceeds supported size.');
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (!parseContainer(bytes).ok) throw new Error('Invalid backup container.');
    return bytes;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try {
      await reader.close();
    } catch (error) {
      if (primary !== undefined)
        throw new AggregateError([primary, error], 'Backup read and handle cleanup failed.');
      throw error;
    }
  }
};

/** Translates provider failures and cancellation once, accepting and writing ciphertext only.
 * @param documents Native selection/streaming transport or provider-contract test transport.
 * @returns Portable file capabilities with no provider paths or raw error strings in results.
 */
export const createBackupFiles = (documents: EncryptedDocuments): BackupFilesPort => ({
  /** Picks a ciphertext stream without trusting reported size or deleting the source.
   * @returns Valid bounded container, explicit cancellation, or sanitized read failure.
   */
  pickEncrypted: async () => {
    try {
      const selection = await documents.pick();
      if (!selection) return { ok: true, value: null };
      return { ok: true, value: await readBounded(selection.reader) };
    } catch {
      return {
        ok: false,
        error: {
          code: 'backup-read-failed',
          message:
            'Unable to read a complete .planbud file of at most 16 MiB. Choose it again and check access.',
        },
      };
    }
  },
  /** Selects an output location only after confirming bytes are an encrypted container.
   * @param bytes Complete structurally validated authenticated container.
   * @returns Saved, explicit cancellation, or storage/grant failure; no plaintext writes occur.
   */
  saveEncrypted: async (bytes) => {
    if (!parseContainer(bytes).ok)
      return {
        ok: false,
        error: {
          code: 'invalid-container',
          message: 'Unable to save an invalid encrypted backup.',
        },
      };
    try {
      const target = await documents.destination();
      if (!target) return { ok: true, value: 'canceled' };
      await target.write(bytes);
      return { ok: true, value: 'saved' };
    } catch {
      return {
        ok: false,
        error: {
          code: 'backup-save-failed',
          message:
            'Unable to save the encrypted backup. Check free space and folder access, then try again.',
        },
      };
    }
  },
});
