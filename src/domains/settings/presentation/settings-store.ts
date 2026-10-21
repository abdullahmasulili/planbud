import { createStore } from 'zustand/vanilla';
import type { Profile } from '../application/public';

/** Replaceable settings projection; SQLite owns the durable profile. */
export type SettingsState = {
  readonly profile: Profile | null;
  readonly sessionGeneration: number;
  readonly replacementNotice: string;
  readonly clearNotice: () => void;
  readonly replaceProfile: (profile: Profile | null) => void;
  readonly replaceSession: (profile: Profile | null) => void;
};

/** Creates an isolated store for one application provider lifetime.
 * @param profile Durable profile loaded during bootstrap, or first-launch absence.
 * @returns Vanilla store without persistence middleware or secret material.
 */
export const createSettingsStore = (profile: Profile | null) =>
  createStore<SettingsState>()((set, get) => ({
    profile,
    sessionGeneration: 0,
    replacementNotice: '',
    /** Dismisses a nonsecret durable-replacement notice after the user has read it. */
    clearNotice: () => {
      set({ replacementNotice: '' });
    },
    /** Invalidates retained form components after a committed profile replacement.
     * @param next Restored profile metadata or cleared local state.
     */
    replaceSession: (next) => {
      set({
        profile: next,
        sessionGeneration: get().sessionGeneration + 1,
        replacementNotice: next
          ? 'Data restored. Check recovery readiness in Backups before exporting again.'
          : 'Local financial data cleared. External encrypted backups were not deleted.',
      });
    },
    /** Replaces loaded settings after a successful durable mutation or data reset.
     * @param next Newly committed profile projection.
     */
    replaceProfile: (next) => {
      set({ profile: next });
    },
  }));
