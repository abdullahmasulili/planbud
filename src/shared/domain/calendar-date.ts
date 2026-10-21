import type { Result } from './result';

/** A validated Gregorian calendar date, independent of a UTC timestamp. */
export type CalendarDate = string;
/** A validated calendar month in YYYY-MM form. */
export type MonthKey = string;

/** Validates a Gregorian date without timezone conversion.
 * @param text Calendar date supplied by a form or import boundary.
 * @returns The date or an invalid-date outcome.
 */
export const parseDate = (text: string): Result<CalendarDate> => {
  const invalid: Result<never> = {
    ok: false,
    error: { code: 'invalid-date', message: 'Enter a valid date in YYYY-MM-DD format.' },
  };
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(text)) return invalid;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return year > 0 && day <= days ? { ok: true, value: text } : invalid;
};

/** Keeps a recorded date in its original calendar month.
 * @param date Validated calendar date.
 * @returns Its month without consulting a device timezone.
 */
export const monthOf = (date: CalendarDate): MonthKey => date.slice(0, 7);

/** Counts the starting and ending month for a goal horizon.
 * @param from Beginning calendar month.
 * @param through Last included calendar month.
 * @returns Positive month count or a horizon error.
 */
export const monthsInclusive = (from: MonthKey, through: MonthKey): Result<number> => {
  if (!parseDate(`${from}-01`).ok || !parseDate(`${through}-01`).ok)
    return {
      ok: false,
      error: { code: 'invalid-horizon', message: 'Choose valid planning months.' },
    };
  const difference =
    (Number(through.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(through.slice(5, 7)) -
    Number(from.slice(5, 7));
  return difference >= 0
    ? { ok: true, value: difference + 1 }
    : {
        ok: false,
        error: { code: 'overdue-horizon', message: 'The deadline is before the planning month.' },
      };
};
