import type { Profile } from '@/domains/settings/application/public';

/** Nonsecret profile-replacement notifications; observers reset projections and remount stale forms. */
export type ProfileEvents = {
  readonly subscribe: (listener: (profile: Profile | null) => void) => () => void;
  readonly replace: (profile: Profile | null) => void;
};

/** Creates a lifecycle-local notification channel without global state or financial record storage.
 * @returns Synchronous replacement notifications for the mounted app composition.
 */
export const createProfileEvents = (): ProfileEvents => {
  const listeners = new Set<(profile: Profile | null) => void>();
  return {
    /** Registers the current provider's invalidation boundary.
     * @param listener Clears projections and replaces confirmed profile metadata.
     * @returns An unsubscribe capability for provider teardown.
     */
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Notifies all mounted owners only after a replacement transaction commits.
     * @param profile Newly restored currency/appearance metadata, or cleared-profile absence.
     */
    replace: (profile) => {
      for (const listener of listeners) listener(profile);
    },
  };
};
