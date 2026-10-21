import type { CalendarDate } from '../domain/calendar-date';

/** Suggests a local calendar date without turning source-record dates into UTC timestamps.
 * @param date Device clock value, injectable for deterministic midnight-boundary tests.
 * @returns Local Gregorian YYYY-MM-DD text for a new form draft.
 * @throws When the device clock cannot provide a supported calendar date.
 */
export const calendarToday = (date = new Date()): CalendarDate => {
  const year = date.getFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1 || year > 9999)
    throw new RangeError('Invalid device date.');
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
