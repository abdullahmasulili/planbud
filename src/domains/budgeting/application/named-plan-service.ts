import { parseNamedPlan } from '../domain/named-plan';
import type { NamedPlan } from '../domain/named-plan';
import type { Result } from '@/shared/domain/result';
import { isAmount, isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';

/** Same-revision replaceable projection of all independent planning estimates. */
export type NamedPlanVersion = { readonly plans: readonly NamedPlan[]; readonly revision: number };
/** Atomic source operations; writes reject stale revisions and preserve monthly records. */
export type NamedPlanPort = {
  readonly read: () => Promise<NamedPlanVersion>;
  readonly save: (input: {
    readonly plan: NamedPlan;
    readonly expectedRevision: number;
  }) => Promise<void>;
  readonly remove: (input: {
    readonly id: string;
    readonly expectedRevision: number;
  }) => Promise<void>;
};
/** Validated operations for named planning estimates, independent of actual transactions. */
export type NamedPlanService = {
  readonly read: () => Promise<Result<NamedPlanVersion>>;
  readonly save: (input: Parameters<NamedPlanPort['save']>[0]) => Promise<Result<void>>;
  readonly remove: (input: Parameters<NamedPlanPort['remove']>[0]) => Promise<Result<void>>;
};

/** Sanitizes storage failures while retaining optimistic-concurrency meaning.
 * @param error Unknown adapter failure.
 * @returns Recoverable failure without leaking source data.
 */
const failure = (error: unknown): Result<never> => {
  const stale =
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'stale-data';
  return {
    ok: false,
    error: {
      code: stale ? 'stale-data' : 'named-plan-unavailable',
      message: stale
        ? 'Your plans changed. Cancel this draft and reload before trying again.'
        : 'Unable to load or save your plans. Try again.',
    },
  };
};

/** Validates mutations and translates storage errors at the application boundary.
 * @param port Atomic durable named-plan capability.
 * @returns Presentation-safe reads and writes.
 */
export const createNamedPlanService = (port: NamedPlanPort): NamedPlanService => ({
  /** Reads one consistent list and revision.
   * @returns Current projection or recoverable storage failure.
   */
  read: async () => {
    try {
      return { ok: true, value: await port.read() };
    } catch (error) {
      return failure(error);
    }
  },
  /** Saves only validated estimates against the user's original source revision.
   * @param input Canonical plan draft and reviewed revision.
   * @returns Completion or validation/stale/storage failure.
   */
  save: async (input) => {
    const parsed = parseNamedPlan(input.plan);
    if (!parsed.ok) return parsed;
    if (!isAmount(input.expectedRevision)) return failure({ code: 'stale-data' });
    try {
      await port.save({ ...input, plan: parsed.value });
      return { ok: true, value: undefined };
    } catch (error) {
      return failure(error);
    }
  },
  /** Removes one explicitly confirmed plan without affecting monthly records.
   * @param input Stable identity and reviewed revision.
   * @returns Completion or stale/storage failure.
   */
  remove: async (input) => {
    if (!isText(input.id, MAX_ID_LENGTH) || !isAmount(input.expectedRevision))
      return failure({ code: 'stale-data' });
    try {
      await port.remove(input);
      return { ok: true, value: undefined };
    } catch (error) {
      return failure(error);
    }
  },
});
