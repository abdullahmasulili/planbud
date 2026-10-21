import type { Result } from '@/shared/domain/result';
import { parseDate } from '@/shared/domain/calendar-date';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import { isAmount, isRecord, isText } from '@/shared/domain/validation';

/** Actual goal earmarking, separate from an expense and from a planned allocation. */
export type Contribution = {
  readonly id: string;
  readonly goalId: string;
  readonly amount: number;
  readonly date: string;
};

/** Validates a positive exact earmarking record and its calendar date.
 * @param input Untrusted form, storage, or snapshot value.
 * @returns Canonical contribution or a field failure without echoing input.
 */
export const parseContribution = (input: unknown): Result<Contribution> => {
  if (
    !isRecord(input) ||
    !isText(input.id, MAX_ID_LENGTH) ||
    !isText(input.goalId, MAX_ID_LENGTH) ||
    !isAmount(input.amount) ||
    input.amount === 0 ||
    typeof input.date !== 'string' ||
    !parseDate(input.date).ok
  )
    return {
      ok: false,
      error: {
        code: 'invalid-contribution',
        message: 'Enter a positive amount, valid date, and an existing goal.',
      },
    };
  return {
    ok: true,
    value: { id: input.id, goalId: input.goalId, amount: input.amount, date: input.date },
  };
};
