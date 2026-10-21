import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import { readRevision } from '@/shared/infrastructure/database/connection';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import { isText } from '@/shared/domain/validation';
import type {
  LocalRecoveryState,
  RecoveryMetadataPort,
  RecoveryMetadata,
} from '../application/recovery-ports';

/** Reads profile and its nonsecret recovery binding inside the owning transaction.
 * @param sql Current consistent transaction capability.
 * @returns Validated active binding; absence of a confirmed profile rejects.
 */
export const readRecoveryMetadata = async (sql: SqlExecutor): Promise<RecoveryMetadata> => {
  const profile = await sql.first('SELECT id FROM profiles WHERE singleton=1');
  if (!isText(profile?.id, MAX_ID_LENGTH))
    throw new Error('Confirm a profile before recovery setup.');
  const row = await sql.first(
    'SELECT recovery_generation,recovery_fingerprint,recovery_status FROM app_metadata WHERE singleton=1',
  );
  if (!row) throw new Error('Missing recovery metadata.');
  let state: LocalRecoveryState | null = null;
  if (
    row.recovery_generation !== null ||
    row.recovery_fingerprint !== null ||
    row.recovery_status !== null
  ) {
    if (
      !isText(row.recovery_generation, MAX_ID_LENGTH) ||
      typeof row.recovery_fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.recovery_fingerprint) ||
      (row.recovery_status !== 'pending' && row.recovery_status !== 'ready')
    )
      throw new Error('Invalid recovery metadata.');
    state = {
      profileId: profile.id,
      generation: row.recovery_generation,
      fingerprint: row.recovery_fingerprint,
      status: row.recovery_status,
    };
  }
  return { profileId: profile.id, revision: await readRevision(sql), state };
};

/** Updates only nonsecret recovery metadata, guarded by the reviewed global revision.
 * @param database Private lifecycle-owned connection.
 * @returns Consistent read and atomic generation-activation ports.
 */
export const createRecoveryMetadata = (database: DatabaseHandle): RecoveryMetadataPort => ({
  /** Reads the active profile and binding under one revision.
   * @returns Local nonsecret metadata only.
   */
  read: async () => await database.read(readRecoveryMetadata),
  /** Activates a protected slot that the workflow saved before this database operation.
   * @param input Reviewed source revision and proposed nonsecret binding.
   * @returns Completion; rejects stale profiles or invalid metadata without modifying records.
   */
  activate: async (input) => {
    await database.write(async (sql) => {
      const current = await readRecoveryMetadata(sql);
      if (
        current.revision !== input.expectedRevision ||
        current.profileId !== input.state.profileId
      )
        throw Object.assign(new Error('Recovery inputs changed.'), { code: 'stale-data' });
      const state = input.state;
      if (
        !isText(state.generation, MAX_ID_LENGTH) ||
        !/^[a-f0-9]{64}$/.test(state.fingerprint) ||
        (state.status !== 'ready' && state.status !== 'pending')
      )
        throw new Error('Invalid recovery binding.');
      if (JSON.stringify(current.state) === JSON.stringify(state))
        return { value: undefined, changed: false };
      await sql.execute(
        'UPDATE app_metadata SET recovery_generation=?,recovery_fingerprint=?,recovery_status=? WHERE singleton=1',
        [state.generation, state.fingerprint, state.status],
      );
      return { value: undefined, changed: true };
    });
  },
});
