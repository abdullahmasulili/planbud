import type { Command, Result } from '@/shared/domain/result';
import { isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import { parseGoal, goalProgress } from '../domain/goal';
import type { Goal, GoalProgress } from '../domain/goal';
import { parseContribution } from '../domain/contribution';
import type { Contribution } from '../domain/contribution';

/** Consistently read source data; totals remain owned by the pure goal policy. */
export type GoalHistory = { readonly goal: Goal; readonly contributions: readonly Contribution[] };
/** Atomic source writes and same-snapshot goal/history read capability. */
export type GoalPort = {
  readonly saveGoal: (command: Command<Goal>) => Promise<Goal>;
  readonly saveContribution: (command: Command<Contribution>) => Promise<Contribution>;
  readonly removeContribution: (command: Command<{ readonly id: string }>) => Promise<void>;
  readonly readGoals: () => Promise<readonly GoalHistory[]>;
};
/** Sanitized goal workflows, suitable for presentation and published planner reads. */
export type GoalService = {
  readonly saveGoal: (command: Command<Goal>) => Promise<Result<Goal>>;
  readonly saveContribution: (command: Command<Contribution>) => Promise<Result<Contribution>>;
  readonly removeContribution: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  readonly readGoals: () => Promise<Result<readonly GoalProgress[]>>;
};

/** Maps persistence failures once without exposing source records or native diagnostics.
 * @param error Untrusted adapter rejection.
 * @returns An actionable replay, overflow, reference or storage failure.
 */
const failure = (error: unknown): Result<never> => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'command-conflict')
    return {
      ok: false,
      error: {
        code,
        message: 'This action was already used. Reopen the form before saving different data.',
      },
    };
  if (code === 'amount-overflow')
    return {
      ok: false,
      error: { code, message: 'Goal savings exceed the supported amount range.' },
    };
  if (code === 'invalid-reference')
    return { ok: false, error: { code, message: 'Reload the goal before changing its history.' } };
  return {
    ok: false,
    error: { code: 'goals-unavailable', message: 'Unable to save or load goals. Try again.' },
  };
};

/** Validates goal operations and recomputes savings through an injected calendar clock.
 * @param port Durable atomic goal capability.
 * @param today Local calendar date capability, never a timezone-converted record timestamp.
 * @returns Typed source-edit and derived-progress use cases.
 */
export const createGoalService = (port: GoalPort, today: () => string): GoalService => ({
  /** Commits metadata once without changing actual history.
   * @param command Source goal and stable action identity.
   * @returns Committed metadata or input/replay/storage failure.
   */
  saveGoal: async (command) => {
    const parsed = parseGoal(command.input);
    if (!parsed.ok) return parsed;
    if (!isText(command.operationId, MAX_ID_LENGTH))
      return {
        ok: false,
        error: { code: 'invalid-command', message: 'Reopen the form before saving.' },
      };
    try {
      return {
        ok: true,
        value: await port.saveGoal({ operationId: command.operationId, input: parsed.value }),
      };
    } catch (error) {
      return failure(error);
    }
  },
  /** Records or corrects one actual earmarking action, separately from spending.
   * @param command Canonical contribution and stable retry identity.
   * @returns Committed source record or a sanitized failure.
   */
  saveContribution: async (command) => {
    const parsed = parseContribution(command.input);
    if (!parsed.ok) return parsed;
    if (!isText(command.operationId, MAX_ID_LENGTH))
      return {
        ok: false,
        error: { code: 'invalid-command', message: 'Reopen the form before saving.' },
      };
    try {
      return {
        ok: true,
        value: await port.saveContribution({
          operationId: command.operationId,
          input: parsed.value,
        }),
      };
    } catch (error) {
      return failure(error);
    }
  },
  /** Removes an earmarking record without duplicating a retried deletion.
   * @param command Stable action identity and source record ID.
   * @returns Completion or an actionable failure.
   */
  removeContribution: async (command) => {
    if (!isText(command.operationId, MAX_ID_LENGTH) || !isText(command.input.id, MAX_ID_LENGTH))
      return {
        ok: false,
        error: { code: 'invalid-command', message: 'Reload the history before deleting.' },
      };
    try {
      await port.removeContribution(command);
      return { ok: true, value: undefined };
    } catch (error) {
      return failure(error);
    }
  },
  /** Derives every goal from one source snapshot; rejects partial or unsafe projections.
   * @returns Source goals with actual savings and attention labels, or a read failure.
   */
  readGoals: async () => {
    try {
      const histories = await port.readGoals();
      const date = today();
      const goals: GoalProgress[] = [];
      for (const history of histories) {
        const result = goalProgress(history.goal, history.contributions, date);
        if (!result.ok) return result;
        goals.push(result.value);
      }
      return { ok: true, value: goals };
    } catch (error) {
      return failure(error);
    }
  },
});
