import { Directory, File, FileMode } from 'expo-file-system';
import { getDocumentAsync } from 'expo-document-picker';
import { randomUUID } from 'expo-crypto';
import type { EncryptedDocuments } from './backup-files';
import { createBackupFiles } from './backup-files';

/** Uses modern Android SAF streams without caching or materializing plaintext files. */
const documents: EncryptedDocuments = {
  /** Selects an existing provider file and opens a bounded read-only native descriptor.
   * @returns Existing ciphertext reader or explicit cancellation; grants/errors reject.
   */
  pick: async () => {
    const result = await getDocumentAsync({
      type: '*/*',
      multiple: false,
      copyToCacheDirectory: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) throw new Error('No backup selected.');
    const handle = new File(asset.uri).open(FileMode.ReadOnly);
    return {
      reportedSize: asset.size ?? null,
      reader: {
        /** Reads at most the requested ciphertext bytes.
         * @param maximum Hard maximum from the container reader.
         * @returns Native partial chunk or EOF.
         */ read: async (maximum) => await handle.readBytes(maximum),
        /** Releases the descriptor without deleting the selected source.
         * @returns Completion or native close failure.
         */ close: async () => {
          handle.close();
        },
      },
    };
  },
  /** Chooses a directory without creating a file until encrypted bytes are ready.
   * @returns A fresh-file writer or explicit picker cancellation.
   */
  destination: async () => {
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ERR_PICKER_CANCELLED'
      )
        return null;
      throw error;
    }
    return {
      /** Creates only a uniquely named app-owned ciphertext file, removing a failed partial write.
       * @param bytes Complete encrypted container; never plaintext.
       * @returns Completion; failure preserves the primary error and any cleanup failure.
       */ write: async (bytes) => {
        const file = directory.createFile(
          `plan-bud-${randomUUID()}.planbud`,
          'application/octet-stream',
        );
        try {
          const handle = file.open(FileMode.WriteOnly);
          let primary: unknown;
          try {
            await handle.writeBytes(bytes);
          } catch (error) {
            primary = error;
            throw error;
          } finally {
            try {
              handle.close();
            } catch (error) {
              if (primary !== undefined)
                throw new AggregateError(
                  [primary, error],
                  'Encrypted write and handle cleanup failed.',
                );
              throw error;
            }
          }
        } catch (error) {
          try {
            file.delete();
          } catch (cleanupError) {
            throw new AggregateError(
              [error, cleanupError],
              'Encrypted file write and cleanup failed.',
            );
          }
          throw error;
        }
      },
    };
  },
};

/** Android encrypted document operations; external locations remain private to this adapter. */
export const androidBackupFiles = createBackupFiles(documents);
