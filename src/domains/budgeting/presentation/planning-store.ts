import { createStore } from 'zustand/vanilla';
import type {
  PlanningPreview,
  PlanningService,
  CategoryLimitEdit,
} from '../application/planning-contract';
import type { Result } from '@/shared/domain/result';

/** Disposable review state; no estimate is applied implicitly when inputs change. */
export type PlanningState = {
  readonly preview: PlanningPreview | null;
  readonly suggestions: readonly CategoryLimitEdit[];
  readonly selected: readonly CategoryLimitEdit[];
  readonly reviewed: boolean;
  readonly message: string;
  readonly open: (month: string) => Promise<void>;
  readonly toggle: (edit: CategoryLimitEdit) => void;
  readonly review: () => Promise<Result<void>>;
  readonly apply: () => Promise<Result<void>>;
  readonly reset: () => void;
};

/** Owns replaceable planning previews and invalidates pending reads after close or restore.
 * @param service Consistent-read and atomic-apply use cases.
 * @returns Scoped preview store with explicit review and apply phases.
 */
export const createPlanningStore = (service: PlanningService) =>
  createStore<PlanningState>()((set, get) => {
    let generation = 0;
    return {
      preview: null,
      suggestions: [],
      selected: [],
      reviewed: false,
      message: '',
      /** Loads an estimate without altering source data.
       * @param month Requested calendar month.
       * @returns Completion after current preview publication or a visible error.
       */
      open: async (month) => {
        const request = ++generation;
        set({ preview: null, suggestions: [], selected: [], reviewed: false, message: '' });
        const result = await service.preview(month);
        if (request !== generation) return;
        if (result.ok)
          set({ preview: result.value, suggestions: result.value.edits, reviewed: true });
        else set({ message: result.error.message });
      },
      /** Changes the selection and requires another visible calculation before apply.
       * @param edit Suggested flexible-limit cut.
       */
      toggle: (edit) => {
        const selected = get().selected;
        set({
          selected: selected.some((item) => item.categoryId === edit.categoryId)
            ? selected.filter((item) => item.categoryId !== edit.categoryId)
            : [...selected, edit],
          reviewed: false,
          message: '',
        });
      },
      /** Recalculates the chosen cuts and invalidates the review if any source input changed.
       * @returns Completion or a sanitized stale/read failure.
       */
      review: async () => {
        const current = get();
        const owner = generation;
        if (!current.preview)
          return {
            ok: false,
            error: { code: 'missing-preview', message: 'Create a fresh preview.' },
          };
        const result = await service.preview(current.preview.month, current.selected);
        if (owner !== generation)
          return {
            ok: false,
            error: { code: 'closed-preview', message: 'Create a fresh preview.' },
          };
        if (!result.ok) return result;
        if (result.value.revision !== current.preview.revision) {
          set({ reviewed: false });
          return {
            ok: false,
            error: {
              code: 'stale-data',
              message: 'Inputs changed. Cancel and create a fresh preview.',
            },
          };
        }
        set({ preview: result.value, reviewed: true });
        return { ok: true, value: undefined };
      },
      /** Applies only the most recently reviewed selection through a revision-checked use case.
       * @returns Durable completion or an actionable stale/validation failure.
       */
      apply: async () => {
        const current = get();
        if (!current.preview || !current.reviewed)
          return {
            ok: false,
            error: { code: 'unreviewed', message: 'Preview selected adjustments before applying.' },
          };
        return await service.apply({ preview: current.preview, selectedEdits: current.selected });
      },
      /** Drops current estimates and invalidates in-flight preview reads. */
      reset: () => {
        generation += 1;
        set({ preview: null, suggestions: [], selected: [], reviewed: false, message: '' });
      },
    };
  });
