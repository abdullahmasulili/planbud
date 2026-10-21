import type { GoalService, GoalProgress } from '@/domains/goals/application/public';
import type { Result } from '@/shared/domain/result';

/** Bounded overview projection with canonical actual goal amounts and current attention labels. */
export type GoalAttention = {
  readonly count: number;
  readonly goals: readonly Pick<
    GoalProgress,
    'id' | 'name' | 'saved' | 'target' | 'remaining' | 'overdue'
  >[];
};

/** Prioritizes current overdue goals while retaining a route to every active incomplete goal.
 * @param goals Published consistent source-progress read capability.
 * @returns At most three current attention rows and the full incomplete-active count.
 */
export const readGoalAttention = async (
  goals: Pick<GoalService, 'readGoals'>,
): Promise<Result<GoalAttention>> => {
  const result = await goals.readGoals();
  if (!result.ok) return result;
  const active = result.value
    .filter((goal) => goal.state === 'active' && goal.remaining > 0)
    .sort(
      (a, b) => Number(b.overdue) - Number(a.overdue) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  return {
    ok: true,
    value: {
      count: active.length,
      goals: active.slice(0, 3).map((goal) => ({
        id: goal.id,
        name: goal.name,
        saved: goal.saved,
        target: goal.target,
        remaining: goal.remaining,
        overdue: goal.overdue,
      })),
    },
  };
};
