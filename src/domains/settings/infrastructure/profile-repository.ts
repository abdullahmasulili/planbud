import type { DatabaseHandle, SqlExecutor } from '@/shared/infrastructure/database/connection';
import type { Profile, ProfilePort } from '../application/public';
import { parseProfile } from '../domain/profile';

/** Reads and validates the sole profile inside the caller's transaction.
 * @param sql Transaction-scoped database capability.
 * @returns Confirmed profile or first-launch absence; rejects damaged rows.
 */
const readProfile = async (sql: SqlExecutor): Promise<Profile | null> => {
  const row = await sql.first(
    'SELECT id,currency_code,currency_exponent,locale,appearance FROM profiles WHERE singleton=1',
  );
  if (!row) return null;
  const parsed = parseProfile({
    id: row.id,
    currency: { code: row.currency_code, exponent: row.currency_exponent },
    locale: row.locale,
    appearance: row.appearance,
  });
  if (!parsed.ok) throw Object.assign(new Error(parsed.error.message), { code: parsed.error.code });
  return parsed.value;
};

/** Implements the immutable-currency singleton using parameterized atomic writes.
 * @param database Lifecycle-owned serialized database handle.
 * @returns Profile port with idempotent confirmation and appearance updates.
 */
export const createProfileRepository = (database: DatabaseHandle): ProfilePort => ({
  /** Reads the current durable profile.
   * @returns Confirmed profile or first-launch absence.
   */
  read: async () => await database.read(readProfile),
  /** Inserts once; an identical retry succeeds without advancing revision.
   * @param profile Confirmed profile metadata.
   * @returns Existing identical identity or the newly inserted profile.
   */
  initialize: async (profile) => {
    const parsed = parseProfile(profile);
    if (!parsed.ok)
      throw Object.assign(new Error(parsed.error.message), { code: parsed.error.code });
    return await database.write(async (sql) => {
      const existing = await readProfile(sql);
      if (existing) {
        if (
          existing.id !== profile.id ||
          existing.currency.code !== profile.currency.code ||
          existing.currency.exponent !== profile.currency.exponent ||
          existing.locale !== profile.locale
        )
          throw Object.assign(new Error('A profile is already confirmed.'), {
            code: 'profile-exists',
          });
        return { value: existing, changed: false };
      }
      await sql.execute(
        'INSERT INTO profiles(singleton,id,currency_code,currency_exponent,locale,appearance) VALUES (1,?,?,?,?,?)',
        [
          profile.id,
          profile.currency.code,
          profile.currency.exponent,
          profile.locale,
          profile.appearance,
        ],
      );
      return { value: parsed.value, changed: true };
    });
  },
  /** Saves an actual appearance change exactly once.
   * @param mode Appearance to persist.
   * @returns Completion; rejects when no profile has been confirmed.
   */
  setAppearance: async (mode) => {
    await database.write(async (sql) => {
      const existing = await readProfile(sql);
      if (!existing) throw new Error('Confirm a profile before changing appearance.');
      if (existing.appearance === mode) return { value: undefined, changed: false };
      await sql.execute('UPDATE profiles SET appearance=? WHERE singleton=1', [mode]);
      return { value: undefined, changed: true };
    });
  },
});
