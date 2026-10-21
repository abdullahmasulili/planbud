import { parseProfile } from '../domain/profile';
import type { ProfileService, ProfilePort } from './public';

/** Translates storage failures once at the settings application boundary.
 * @param repository Durable singleton profile port.
 * @returns Validated, sanitized settings operations.
 */
export const createProfileService = (repository: ProfilePort): ProfileService => ({
  /** Loads the confirmed profile without exposing storage diagnostics.
   * @returns Profile, first-launch absence, or a recoverable read error.
   */
  load: async () => {
    try {
      return { ok: true, value: await repository.read() };
    } catch {
      return {
        ok: false,
        error: { code: 'profile-unavailable', message: 'Unable to open settings. Try again.' },
      };
    }
  },
  /** Confirms one currency before financial records can be entered.
   * @param profile Proposed local profile.
   * @returns Confirmed profile or validation/storage failure.
   */
  confirm: async (profile) => {
    const parsed = parseProfile(profile);
    if (!parsed.ok) return parsed;
    try {
      return { ok: true, value: await repository.initialize(parsed.value) };
    } catch {
      return {
        ok: false,
        error: {
          code: 'profile-unavailable',
          message: 'Unable to confirm settings. Your existing currency stays unchanged.',
        },
      };
    }
  },
  /** Persists the selected scheme without changing the financial currency.
   * @param mode System, light, or dark appearance.
   * @returns Completion or a retryable write failure.
   */
  changeAppearance: async (mode) => {
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark')
      return {
        ok: false,
        error: { code: 'invalid-appearance', message: 'Choose system, light, or dark.' },
      };
    try {
      await repository.setAppearance(mode);
      return { ok: true, value: undefined };
    } catch {
      return {
        ok: false,
        error: { code: 'profile-unavailable', message: 'Unable to save appearance. Try again.' },
      };
    }
  },
});
