import type { CalendarDate } from '@/shared/domain/calendar-date';
import { parseDate } from '@/shared/domain/calendar-date';
import type { MinorAmount } from '@/shared/domain/money';
import type { Result } from '@/shared/domain/result';
import { isAmount, isRecord, isText } from '@/shared/domain/validation';
import { MAX_ID_LENGTH, MAX_NOTE_LENGTH } from '@/shared/domain/record-limits';

/** Source income or expense; goal earmarking is intentionally a separate record type. */
export type Transaction = {
  readonly id: string;
  readonly type: 'income' | 'expense';
  readonly amount: MinorAmount;
  readonly date: CalendarDate;
  readonly categoryId: string | null;
  readonly note: string;
};

/** Validates financial entry input and strips fields outside the portable record contract.
 * @param input Untrusted form, database, or import record.
 * @returns Positive exact amount, valid calendar date, and a consistent category relationship.
 */
export const parseTransaction = (input: unknown): Result<Transaction> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-transaction',
      message:
        'Enter a positive amount, valid date, and an expense category. Notes can contain up to 2000 characters.',
    },
  };
  if (
    !isRecord(input) ||
    !isText(input.id, MAX_ID_LENGTH) ||
    (input.type !== 'income' && input.type !== 'expense') ||
    !isAmount(input.amount) ||
    input.amount === 0 ||
    typeof input.date !== 'string' ||
    !parseDate(input.date).ok ||
    typeof input.note !== 'string' ||
    input.note.length > MAX_NOTE_LENGTH * 2 ||
    [...input.note].length > MAX_NOTE_LENGTH ||
    input.note.includes('\u0000')
  )
    return invalid;
  if (input.type === 'income') {
    if (input.categoryId !== null) return invalid;
  } else if (!isText(input.categoryId, MAX_ID_LENGTH)) return invalid;
  const categoryId = input.categoryId;
  if (categoryId !== null && typeof categoryId !== 'string') return invalid;
  return {
    ok: true,
    value: {
      id: input.id,
      type: input.type,
      amount: input.amount,
      date: input.date,
      categoryId,
      note: input.note,
    },
  };
};
