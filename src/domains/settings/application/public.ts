import type { Profile } from '../domain/profile';
import type { Result } from '@/shared/domain/result';
export type { Profile } from '../domain/profile';
export { parseProfile } from '../domain/profile';
/** Durable singleton profile lifecycle; rejected promises preserve storage failures. */
export type ProfilePort = {
  readonly read: () => Promise<Profile | null>;
  readonly initialize: (profile: Profile) => Promise<Profile>;
  readonly setAppearance: (mode: Profile['appearance']) => Promise<void>;
};
/** Sanitized settings operations consumed by presentation. */
export type ProfileService = {
  readonly load: () => Promise<Result<Profile | null>>;
  readonly confirm: (profile: Profile) => Promise<Result<Profile>>;
  readonly changeAppearance: (mode: Profile['appearance']) => Promise<Result<void>>;
};
