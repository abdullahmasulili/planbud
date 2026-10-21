import type { Result } from '@/shared/domain/result';
import { parseDate } from '@/shared/domain/calendar-date';
import type { PlanningService, PlanningPorts } from './planning-contract';
import { allocateGoals } from '../domain/allocate-goals';
import { adjustPlanningInput } from '../domain/planning-adjustments';

/** Sanitizes consistent-read and atomic-commit failures without exposing stored values.
 * @param error Unknown adapter rejection.
 * @returns An actionable stale-data or storage failure.
 */
const failure = (error: unknown): Result<never> => {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'stale-data')
    return {
      ok: false,
      error: {
        code: 'stale-data',
        message: 'Planning inputs changed. Cancel and create a fresh preview.',
      },
    };
  return {
    ok: false,
    error: {
      code: 'planning-unavailable',
      message: 'Unable to load or save this plan. Try again.',
    },
  };
};

/** Recalculates user-reviewed estimates against current data before any durable commitment.
 * @param ports Consistent source reads and atomic compare/recalculate/commit capability.
 * @returns Explicit preview and apply workflows with no automatic source changes.
 */
export const createPlanningService = (ports: PlanningPorts): PlanningService => ({
  /** Previews current data and optional selected cuts without writing a plan.
   * @param month Calendar month to estimate.
   * @param edits Selected flexible cuts, shown before the final apply action.
   * @returns Explainable deterministic allocation and suggestions, or a validation/read failure.
   */
  preview: async (month, edits = []) => {
    if (!/^\d{4}-\d{2}$/.test(month) || !parseDate(month + '-01').ok)
      return {
        ok: false,
        error: { code: 'invalid-month', message: 'Choose a valid calendar month.' },
      };
    try {
      const input = await ports.readInput(month);
      const adjusted = adjustPlanningInput(input, edits);
      if (!adjusted.ok) return adjusted;
      return allocateGoals(adjusted.value);
    } catch (error) {
      return failure(error);
    }
  },
  /** Rejects stale or altered previews, then delegates atomic recalculation and replacement.
   * @param input Visible preview and the exact selected cuts reviewed with it.
   * @returns Completion; changes preserve actual contributions and historical monthly plans.
   */
  apply: async (input) => {
    try {
      const current = await ports.readInput(input.preview.month);
      if (current.revision !== input.preview.revision) return failure({ code: 'stale-data' });
      const adjusted = adjustPlanningInput(current, input.selectedEdits);
      if (!adjusted.ok) return adjusted;
      const recalculated = allocateGoals(adjusted.value);
      if (!recalculated.ok) return recalculated;
      if (JSON.stringify(recalculated.value) !== JSON.stringify(input.preview))
        return {
          ok: false,
          error: {
            code: 'stale-preview',
            message: 'Preview the selected adjustments again before applying.',
          },
        };
      await ports.commit({
        expectedRevision: current.revision,
        month: current.month,
        edits: input.selectedEdits,
        allocations: recalculated.value.allocations.map((row) => ({
          goalId: row.goalId,
          amount: row.allocated,
        })),
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return failure(error);
    }
  },
});
