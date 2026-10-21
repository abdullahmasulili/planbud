import type { PlanningInput, CategoryLimitEdit } from './allocate-goals';
import type { Result } from '@/shared/domain/result';
import { isAmount } from '@/shared/domain/validation';

/** Applies explicit reductions only to flexible limits without cutting below recorded spending.
 * @param input Current consistent source estimates and actuals.
 * @param edits User-selected adjustments from a visible preview.
 * @returns Prospective inputs or an invalid-adjustment failure with no mutation.
 */
export const adjustPlanningInput = (
  input: PlanningInput,
  edits: readonly CategoryLimitEdit[],
): Result<PlanningInput> => {
  if (
    new Set(edits.map((edit) => edit.categoryId)).size !== edits.length ||
    edits.some((edit) => {
      const category = input.categories.find((item) => item.id === edit.categoryId);
      return (
        !category ||
        category.kind !== 'flexible' ||
        !isAmount(edit.amount) ||
        edit.amount < category.spent ||
        edit.amount > category.limit
      );
    })
  )
    return {
      ok: false,
      error: {
        code: 'invalid-adjustment',
        message: 'Only reduce flexible limits, and keep each limit at or above recorded spending.',
      },
    };
  return {
    ok: true,
    value: {
      ...input,
      categories: input.categories.map((category) => ({
        ...category,
        limit: edits.find((edit) => edit.categoryId === category.id)?.amount ?? category.limit,
      })),
    },
  };
};
