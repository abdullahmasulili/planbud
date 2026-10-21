import type { DatabaseHandle } from './connection';
import { INITIAL_SCHEMA, SCHEMA_VERSION } from './schema';

/** Migrates the app database without resetting existing records.
 * @param database Lifecycle-owned database handle.
 * @returns Completion or rejection for an unsupported/corrupt schema.
 */
export const migrateDatabase = async (database: DatabaseHandle): Promise<void> => {
  await database.schema(async (sql) => {
    const row = await sql.first('PRAGMA user_version');
    const version = row?.user_version;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version > SCHEMA_VERSION) {
      throw Object.assign(new Error('This database requires an unsupported app version.'), {
        code: 'unsupported-schema',
      });
    }
    if (version === 0) {
      await sql.batch(INITIAL_SCHEMA);
      await sql.batch(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }
  });
};
