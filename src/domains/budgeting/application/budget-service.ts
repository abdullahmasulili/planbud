import { parseCategory } from '../domain/category';
import type { Category } from '../domain/category';
import { parseMonthlyPlan } from '../domain/monthly-plan';
import type { MonthlyPlan, PlanVersion } from '../domain/monthly-plan';
import type { MonthKey } from '@/shared/domain/calendar-date';
import type { Result } from '@/shared/domain/result';
import { isAmount } from '@/shared/domain/validation';

/** Atomic budget persistence port; repositories reject invalid or stale mutations. */
export type BudgetPort = {
  readonly saveCategory: (category: Category) => Promise<Category>;
  readonly savePlan: (input: {
    readonly plan: MonthlyPlan;
    readonly expectedRevision: number;
  }) => Promise<PlanVersion>;
  readonly readMonth: (month: MonthKey) => Promise<PlanVersion>;
  readonly readCategories: () => Promise<readonly Category[]>;
};
/** Validated budget operations exposed to presentation and planning composition. */
export type BudgetService = {
  readonly saveCategory: (category: Category) => Promise<Result<Category>>;
  readonly savePlan: (input: {
    readonly plan: MonthlyPlan;
    readonly expectedRevision: number;
  }) => Promise<Result<PlanVersion>>;
  readonly readMonth: (month: MonthKey) => Promise<Result<PlanVersion>>;
  readonly readCategories: () => Promise<Result<readonly Category[]>>;
};

/** Translates one budget storage failure into an actionable, non-sensitive outcome.
 * @param error Unknown adapter rejection.
 * @returns Sanitized failure preserving stale-preview semantics.
 */
const storageFailure = (error: unknown): Result<never> => {
  const stale =
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'stale-data';
  return {
    ok: false,
    error: {
      code: stale ? 'stale-data' : 'budget-unavailable',
      message: stale
        ? 'Your data changed. Reload this month before saving again.'
        : 'Unable to save or load this budget. Check the categories and try again.',
    },
  };
};

/** Validates budget use cases and translates adapter failures at one application boundary.
 * @param port Atomic durable budget operations.
 * @returns Presentation-safe use cases with no concrete storage dependency.
 */
export const createBudgetService = (port: BudgetPort): BudgetService => ({
  /** Validates and saves category metadata without deleting historical references.
   * @param category Category to create, edit, or archive.
   * @returns Committed canonical category or validation/storage failure.
   */
  saveCategory: async (category) => {
    const parsed = parseCategory(category);
    if (!parsed.ok) return parsed;
    try {
      return { ok: true, value: await port.saveCategory(parsed.value) };
    } catch (error) {
      return storageFailure(error);
    }
  },
  /** Saves one independent month against the revision shown to the user.
   * @param input Proposed monthly estimate and original revision.
   * @returns Committed plan version or a stale/invalid/storage failure.
   */
  savePlan: async (input) => {
    const parsed = parseMonthlyPlan(input.plan);
    if (!parsed.ok) return parsed;
    if (!isAmount(input.expectedRevision))
      return {
        ok: false,
        error: { code: 'invalid-revision', message: 'Reload this month before saving.' },
      };
    try {
      return {
        ok: true,
        value: await port.savePlan({
          plan: parsed.value,
          expectedRevision: input.expectedRevision,
        }),
      };
    } catch (error) {
      return storageFailure(error);
    }
  },
  /** Loads a consistent plan projection without inventing historical amounts.
   * @param month Calendar month to inspect.
   * @returns Stored plan or an empty zero estimate with current revision.
   */
  readMonth: async (month) => {
    const parsed = parseMonthlyPlan({ month, plannedIncome: 0, limits: [] });
    if (!parsed.ok) return parsed;
    try {
      return { ok: true, value: await port.readMonth(month) };
    } catch (error) {
      return storageFailure(error);
    }
  },
  /** Includes archived categories so historical records remain interpretable.
   * @returns Stable category projections or a recoverable load failure.
   */
  readCategories: async () => {
    try {
      return { ok: true, value: await port.readCategories() };
    } catch (error) {
      return storageFailure(error);
    }
  },
});
